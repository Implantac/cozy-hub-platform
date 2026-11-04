import importlib.util
import json
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("velt_local_render", Path(__file__).with_name("render.py"))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class LocalRendererTest(unittest.TestCase):
    def test_caption_chunks_preserve_words(self):
        text = "Organize suas ideias e escolha uma prioridade para começar o trabalho hoje."
        chunks = renderer.chunks(text, 20)
        self.assertEqual(" ".join(chunks), text)
        self.assertTrue(all(len(chunk) <= 20 for chunk in chunks))
        with self.assertRaises(ValueError):
            renderer.chunks("x" * 21, 20)

    def test_generates_mp4_from_local_wav(self):
        font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        if not font.exists():
            self.skipTest("Fonte de teste não disponível")
        try:
            renderer.get_ffmpeg()
        except RuntimeError:
            self.skipTest("FFmpeg não disponível")
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            script, audio, output = path / "script.json", path / "audio.wav", path / "video.mp4"
            script.write_text(json.dumps({"version": 1, "title": "Teste", "narration": "Primeira dica. Outra dica."}), encoding="utf-8")
            with wave.open(str(audio), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(8000)
                wav.writeframes(b"\x00\x00" * 8000)
            args = SimpleNamespace(script=script, audio=audio, piper_model=None, output=output, background=None,
                                   font=font, width=360, height=640, overwrite=False)
            self.assertEqual(renderer.render(args), output.resolve())
            self.assertGreater(output.stat().st_size, 1000)
            with self.assertRaises(ValueError):
                renderer.render(args)


if __name__ == "__main__":
    unittest.main()
