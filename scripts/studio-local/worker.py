#!/usr/bin/env python3
"""Private, single-process local renderer for VELT's development pilot.

Binds only to loopback, requires a shared secret and accepts no user file paths.
Jobs are ephemeral; do not use this proof of concept for a public deployment.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
from types import SimpleNamespace
import uuid

import render

MAX_BODY = 16 * 1024
MAX_VIDEO = 8 * 1024 * 1024
MAX_JOBS = 4
TTL_SECONDS = 3600


class LocalQueue:
    def __init__(self, voice_model, font, render_fn=render.render):
        self.voice_model = voice_model
        self.font = font
        self.render_fn = render_fn
        self.jobs = {}
        self.lock = threading.Lock()
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.directory = Path(tempfile.mkdtemp(prefix="velt-local-jobs-"))

    def cleanup(self):
        now = time.time()
        for job_id, job in list(self.jobs.items()):
            if job["status"] in ("completed", "failed") and now - job["updated"] > TTL_SECONDS:
                shutil.rmtree(self.directory / job_id, ignore_errors=True)
                del self.jobs[job_id]

    def submit(self, user_id, workspace_id, title, narration):
        with self.lock:
            self.cleanup()
            if len(self.jobs) >= 50 or sum(j["status"] in ("queued", "processing") for j in self.jobs.values()) >= MAX_JOBS:
                raise OverflowError("queue full")
            job_id = str(uuid.uuid4())
            self.jobs[job_id] = {"user": user_id, "workspace": workspace_id, "status": "queued", "updated": time.time()}
            try:
                self.executor.submit(self._run, job_id, title, narration)
            except Exception:
                del self.jobs[job_id]
                raise
            return job_id

    def _run(self, job_id, title, narration):
        with self.lock:
            job = self.jobs[job_id]
            job["status"], job["updated"] = "processing", time.time()
        folder = self.directory / job_id
        try:
            folder.mkdir(mode=0o700)
            script = folder / "script.json"
            script.write_text(json.dumps({"version": 1, "title": title, "narration": narration}), encoding="utf-8")
            args = SimpleNamespace(script=script, audio=None, piper_model=self.voice_model,
                                   output=folder / "video.mp4", background=None, font=self.font,
                                   width=720, height=1280, overwrite=False)
            self.render_fn(args)
            if args.output.stat().st_size > MAX_VIDEO:
                raise ValueError("output too large")
            with self.lock:
                job["status"], job["updated"] = "completed", time.time()
        except Exception as exc:
            # Log the class only: exception messages may include user text, file
            # paths, credentials or other private runtime details.
            print(f"[studio-worker] render failed ({type(exc).__name__})", file=sys.stderr, flush=True)
            shutil.rmtree(folder, ignore_errors=True)
            with self.lock:
                job["status"], job["updated"] = "failed", time.time()

    def status(self, job_id, user_id, workspace_id):
        with self.lock:
            self.cleanup()
            job = self.jobs.get(job_id)
            if not job or job["user"] != user_id or job["workspace"] != workspace_id:
                return None
            return job["status"]

    def video(self, job_id, user_id, workspace_id):
        with self.lock:
            self.cleanup()
            job = self.jobs.get(job_id)
            if not job or job["user"] != user_id or job["workspace"] != workspace_id or job["status"] != "completed":
                return None
            return (self.directory / job_id / "video.mp4").read_bytes()

    def close(self):
        self.executor.shutdown(wait=True)
        shutil.rmtree(self.directory, ignore_errors=True)


def valid_uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value.lower()
    except (TypeError, ValueError, AttributeError):
        return False


def handler_for(queue, secret):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log authorization headers or submitted scripts.

        def reply(self, code, data):
            payload = json.dumps(data).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            auth = self.headers.get("Authorization", "")
            if not hmac.compare_digest(auth, "Bearer " + secret):
                return self.reply(401, {"error": "unauthorized"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_BODY:
                    return self.reply(413, {"error": "invalid size"})
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError()
                user_id, workspace_id = payload.get("userId"), payload.get("workspaceId")
                if not valid_uuid(user_id) or not valid_uuid(workspace_id):
                    raise ValueError()
                if self.path == "/v1/jobs":
                    title, narration = payload.get("title"), payload.get("narration")
                    if not isinstance(title, str) or not isinstance(narration, str) or not 1 <= len(title.strip()) <= 200 or not 1 <= len(narration.strip()) <= 3000:
                        raise ValueError()
                    job_id = queue.submit(user_id, workspace_id, title.strip(), narration.strip())
                    return self.reply(202, {"jobId": job_id, "status": "queued"})
                job_id = payload.get("jobId")
                if not valid_uuid(job_id):
                    raise ValueError()
                if self.path == "/v1/status":
                    status = queue.status(job_id, user_id, workspace_id)
                    return self.reply(200, {"status": status}) if status else self.reply(404, {"error": "not found"})
                if self.path == "/v1/download":
                    video = queue.video(job_id, user_id, workspace_id)
                    return self.reply(200, {"data": base64.b64encode(video).decode("ascii")}) if video else self.reply(404, {"error": "not found"})
                return self.reply(404, {"error": "not found"})
            except OverflowError:
                return self.reply(429, {"error": "queue full"})
            except (ValueError, TypeError, json.JSONDecodeError):
                return self.reply(400, {"error": "invalid request"})
    return Handler


def main():
    secret = os.environ.get("STUDIO_WORKER_SECRET", "")
    model = Path(os.environ.get("VELT_PIPER_MODEL", ""))
    font = Path(os.environ.get("VELT_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    if len(secret) < 32 or not secret.isascii() or not model.is_file() or not font.is_file():
        print("Configure STUDIO_WORKER_SECRET (mínimo 32 caracteres ASCII), VELT_PIPER_MODEL e uma fonte existente.", file=sys.stderr)
        return 1
    if not shutil.which("piper"):
        print("Piper não encontrado no PATH.", file=sys.stderr)
        return 1
    try:
        render.get_ffmpeg()
        port = int(os.environ.get("STUDIO_WORKER_PORT", "8765"))
        if not 1 <= port <= 65535:
            raise ValueError()
    except (RuntimeError, ValueError):
        print("FFmpeg ausente ou porta inválida.", file=sys.stderr)
        return 1
    queue = LocalQueue(model, font)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(queue, secret))
    print(f"VELT Studio worker privado escutando em 127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        queue.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
