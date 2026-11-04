"""Opt-in local smoke test: real Piper voice -> worker HTTP -> MP4 with sound.

Set VELT_TEST_PIPER_MODEL to a model you have permission to use. This does not
contact Supabase, a model API, or a social platform, and never publishes media.
"""
import base64
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
import unittest
from array import array
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen

import worker

USER = "c32b66e4-1fc1-4b25-92e7-1b690218f453"
WORKSPACE = "7e6bcb6d-fb76-4604-a8b4-8bf3bfc9b53c"
SECRET = "test-only-secret-" + "x" * 32


class RealVoiceSmokeTest(unittest.TestCase):
    def test_real_piper_to_downloadable_video(self):
        model = Path(os.environ.get("VELT_TEST_PIPER_MODEL", ""))
        if not model.is_file():
            self.skipTest("Defina VELT_TEST_PIPER_MODEL para uma voz ONNX local.")
        if not shutil.which("piper"):
            self.skipTest("Instale piper-tts no ambiente de teste.")
        font = Path(os.environ.get("VELT_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        if not font.is_file():
            self.skipTest("Configure VELT_FONT com uma fonte existente.")
        try:
            ffmpeg = worker.render.get_ffmpeg()
        except RuntimeError:
            self.skipTest("Instale FFmpeg ou imageio-ffmpeg.")

        queue = worker.LocalQueue(model, font)
        server = ThreadingHTTPServer(("127.0.0.1", 0), worker.handler_for(queue, SECRET))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def request(endpoint, payload):
            req = Request(
                f"http://127.0.0.1:{server.server_port}/v1/{endpoint}",
                data=json.dumps(payload).encode(),
                headers={"Authorization": "Bearer " + SECRET, "Content-Type": "application/json"},
            )
            with urlopen(req, timeout=30) as response:
                return response.status, json.load(response)

        try:
            status, created = request("jobs", {
                "userId": USER, "workspaceId": WORKSPACE,
                "title": "Uma ideia por vez",
                "narration": "Escolha uma prioridade para hoje e reserve dez minutos para começar.",
            })
            self.assertEqual(status, 202)
            lookup = {"userId": USER, "workspaceId": WORKSPACE, "jobId": created["jobId"]}
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                _, state = request("status", lookup)
                if state["status"] in ("completed", "failed"):
                    break
                time.sleep(.5)
            self.assertEqual(state["status"], "completed")
            status, result = request("download", lookup)
            self.assertEqual(status, 200)
            video = base64.b64decode(result["data"], validate=True)
            self.assertIn(b"ftyp", video[:32])
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "video.mp4"
                path.write_bytes(video)
                audio = subprocess.run(
                    [ffmpeg, "-v", "error", "-i", str(path), "-vn", "-f", "s16le", "-ac", "1", "-ar", "8000", "-"],
                    capture_output=True, check=True, timeout=30,
                ).stdout
                samples = array("h", audio)
                self.assertGreater(len(samples), 8000)  # at least one second of audio
                rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
                self.assertGreater(rms, 100)  # catches silent audio, not speech quality
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
            queue.close()


if __name__ == "__main__":
    unittest.main()
