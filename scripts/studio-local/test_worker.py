import base64
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

import worker

USER = "c32b66e4-1fc1-4b25-92e7-1b690218f453"
WORKSPACE = "7e6bcb6d-fb76-4604-a8b4-8bf3bfc9b53c"
OTHER = "8038670e-755c-4eb3-9750-38d5cb376547"
SECRET = "s" * 40


class WorkerTest(unittest.TestCase):
    def test_auth_isolation_and_real_video_pipeline_with_fake_voice(self):
        try:
            worker.render.get_ffmpeg()
        except RuntimeError:
            self.skipTest("FFmpeg ausente")
        font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        if not font.is_file():
            self.skipTest("Fonte ausente")
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            piper = temp / "piper"
            piper.write_text('''#!/usr/bin/env python3
import sys, wave
sys.stdin.read()
with wave.open(sys.argv[sys.argv.index("--output_file")+1], "wb") as f:
 f.setnchannels(1); f.setsampwidth(2); f.setframerate(8000); f.writeframes(b"\\0\\0"*8000)
''')
            piper.chmod(0o755)
            model = temp / "model.onnx"
            model.touch()
            old_path = os.environ.get("PATH", "")
            os.environ["PATH"] = str(temp) + os.pathsep + old_path
            queue = worker.LocalQueue(model, font)
            server = ThreadingHTTPServer(("127.0.0.1", 0), worker.handler_for(queue, SECRET))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()

            def request(path, data, token=SECRET):
                req = Request(f"http://127.0.0.1:{server.server_port}/v1/{path}",
                              data=json.dumps(data).encode(),
                              headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
                try:
                    with urlopen(req, timeout=15) as response:
                        return response.status, json.load(response)
                except HTTPError as error:
                    return error.code, json.load(error)
            try:
                payload = {"userId": USER, "workspaceId": WORKSPACE, "title": "Teste", "narration": "Uma explicação breve."}
                self.assertEqual(request("jobs", payload, "incorrect")[0], 401)
                status, created = request("jobs", payload)
                self.assertEqual(status, 202)
                query = {"userId": USER, "workspaceId": WORKSPACE, "jobId": created["jobId"]}
                self.assertEqual(request("status", {**query, "userId": OTHER})[0], 404)
                self.assertEqual(request("download", {**query, "workspaceId": OTHER})[0], 404)
                for _ in range(100):
                    _, state = request("status", query)
                    if state.get("status") in ("completed", "failed"):
                        break
                    time.sleep(.1)
                self.assertEqual(state["status"], "completed")
                status, result = request("download", query)
                self.assertEqual(status, 200)
                video = base64.b64decode(result["data"], validate=True)
                self.assertGreater(len(video), 1000)
                self.assertIn(b"ftyp", video[:32])
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
                queue.close()
                os.environ["PATH"] = old_path


if __name__ == "__main__":
    unittest.main()
