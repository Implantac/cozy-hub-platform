#!/usr/bin/env python3
"""Offline proof of concept: script JSON + WAV or local Piper -> vertical MP4.

No shell, network, background worker, posting, or external AI services are used.
Captions use proportional timing and must be reviewed before publishing.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave

from PIL import Image, ImageDraw, ImageFont, ImageOps


def chunks(text, max_chars=52):
    words = text.split()
    result, current = [], ""
    for word in words:
        if len(word) > max_chars:
            raise ValueError("Palavra longa demais para legendar; revise a narração.")
        trial = f"{current} {word}".strip()
        if len(trial) > max_chars:
            result.append(current)
            current = word
        else:
            current = trial
    if current:
        result.append(current)
    return result


def get_ffmpeg():
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as exc:
        raise RuntimeError("Instale FFmpeg ou o pacote imageio-ffmpeg.") from exc


def wav_duration(path):
    with wave.open(str(path), "rb") as audio:
        if audio.getcomptype() != "NONE" or audio.getframerate() <= 0:
            raise ValueError("O áudio precisa ser WAV PCM não comprimido.")
        return audio.getnframes() / audio.getframerate()


def wrap(draw, text, font, max_width):
    lines, current = [], ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_frame(title, caption, out, width, height, font_path, background):
    if background:
        with Image.open(background) as source:
            image = ImageOps.fit(source.convert("RGB"), (width, height))
        overlay = Image.new("RGBA", (width, height), (4, 9, 22, 155))
        image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    else:
        image = Image.new("RGB", (width, height), (15, 23, 42))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), max(18, width // 17))
    title_font = ImageFont.truetype(str(font_path), max(16, width // 22))
    margin = width // 10
    draw.rounded_rectangle((margin, height // 9, width - margin, height // 9 + height // 5), radius=max(8, width // 30), fill=(29, 45, 70))
    title_lines = wrap(draw, title, title_font, width - margin * 3)
    if len(title_lines) > 3:
        title_lines = title_lines[:3]
        title_lines[-1] = title_lines[-1].rstrip(" .") + "…"
    y = height // 9 + height // 35
    for line in title_lines:
        draw.text((margin + width // 20, y), line, font=title_font, fill="white")
        y += int(width / 18)
    lines = wrap(draw, caption, font, width - margin * 2)
    y = height * 55 // 100 - len(lines) * width // 30
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        x = max(margin, (width - (box[2] - box[0])) // 2)
        draw.text((x, y), line, font=font, fill="white", stroke_width=max(1, width // 360), stroke_fill="black")
        y += width // 12
    image.save(out, "PNG")


def render(args):
    with open(args.script, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("version") != 1 or not isinstance(data.get("title"), str) or not isinstance(data.get("narration"), str):
        raise ValueError("JSON inválido: versão 1, título e narração são obrigatórios.")
    title, text = data["title"].strip(), data["narration"].strip()
    if not title or len(title) > 200 or not text or len(text) > 5000:
        raise ValueError("Título ou narração vazios ou muito longos.")
    captions = chunks(text)
    if len(captions) > 100:
        raise ValueError("Narração muito longa para este protótipo.")
    if args.width < 180 or args.width > 1080 or args.height != args.width * 16 // 9 or args.width % 2:
        raise ValueError("Use largura par de 180 a 1080; a altura deve ter proporção 9:16.")
    if not args.font.is_file():
        raise ValueError("Fonte não encontrada; informe --font com uma fonte TTF/OTF.")
    output = args.output.resolve()
    if output.suffix.lower() != ".mp4":
        raise ValueError("A saída deve terminar em .mp4.")
    if output.exists() and not args.overwrite:
        raise ValueError("Saída já existe. Use --overwrite para substituir.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="velt-render-") as temp:
        folder = Path(temp)
        if args.audio:
            audio = args.audio.resolve()
        else:
            if not args.piper_model or not args.piper_model.is_file():
                raise ValueError("Informe --audio WAV ou --piper-model ONNX.")
            piper = shutil.which("piper")
            if not piper:
                raise RuntimeError("Piper não encontrado. Instale piper-tts no ambiente local.")
            audio = folder / "narration.wav"
            subprocess.run([piper, "--model", str(args.piper_model.resolve()), "--output_file", str(audio)],
                           input=text, text=True, check=True, timeout=300)
        duration = wav_duration(audio)
        if not 0.5 <= duration <= 120:
            raise ValueError("O áudio deve durar entre 0,5 e 120 segundos.")
        weights = [len(c) for c in captions]
        total = sum(weights)
        durations = [duration * weight / total for weight in weights]
        manifest = folder / "frames.ffconcat"
        with manifest.open("w", encoding="utf-8") as out:
            out.write("ffconcat version 1.0\n")
            for index, (caption, frame_duration) in enumerate(zip(captions, durations)):
                name = f"frame-{index:03}.png"
                draw_frame(title, caption, folder / name, args.width, args.height, args.font, args.background)
                out.write(f"file '{name}'\nduration {frame_duration:.6f}\n")
            out.write(f"file 'frame-{len(captions)-1:03}.png'\n")
        command = [get_ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", str(manifest),
                   "-i", str(audio), "-t", f"{duration:.3f}", "-r", "25", "-c:v", "libx264", "-preset", "veryfast",
                   "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(output)]
        subprocess.run(command, cwd=folder, check=True, timeout=600)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--script", type=Path, required=True, help="JSON exportado pelo VELT Studio")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--audio", type=Path, help="Áudio WAV PCM fornecido pelo usuário")
    source.add_argument("--piper-model", type=Path, help="Modelo ONNX de voz local do Piper")
    parser.add_argument("--output", type=Path, required=True, help="Arquivo MP4 de saída")
    parser.add_argument("--background", type=Path, help="Imagem de fundo autorizada, opcional")
    parser.add_argument("--font", type=Path, default=Path(os.environ.get("VELT_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")))
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--height", type=int, default=1280)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        print(f"Vídeo criado: {render(args)}\nRevise o resultado e a sincronização das legendas antes de publicar.")
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, wave.Error, json.JSONDecodeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
