#!/usr/bin/env python3
"""Build client/public/media/mfa-first-login-setup.mp4 with macOS TTS voiceover (≤45s)."""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client/public/media/mfa-first-login-setup.mp4"
WORK = ROOT / "client/public/media/.build-mfa-video"
W, H = 1280, 720
FPS = 30
MAX_SECONDS = 45

SEGMENTS = [
    {
        "num": "1",
        "title": "Sign in",
        "voice": "Sign in with your invitation email and password. MFA setup appears next.",
        "caption": "Use your invitation email and password.",
    },
    {
        "num": "2",
        "title": "Scan QR code",
        "voice": "Open your authenticator app and tap Scan QR code. Do not use your phone Camera app.",
        "caption": "Use Scan QR code inside your authenticator app, not the Camera app.",
    },
    {
        "num": "3",
        "title": "Enable",
        "voice": "Scan the code on screen, enter the six digit code, and tap Enable authenticator.",
        "caption": "Enter the 6-digit code and tap Enable authenticator.",
    },
]

TEAL = (14, 116, 144)
INK = (20, 20, 20)
SLATE = (69, 90, 100)
BG = (244, 248, 249)
WHITE = (255, 255, 255)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if draw.textlength(trial, font=font) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines or [text]


def render_slide(segment: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    title_font = load_font(34, bold=True)
    sub_font = load_font(22)
    step_font = load_font(44, bold=True)
    head_font = load_font(52, bold=True)
    body_font = load_font(30)

    draw.rectangle((0, 0, W, 120), fill=TEAL)
    draw.text((60, 42), "PECC Support Tool", font=title_font, fill=WHITE)
    draw.text((60, 82), "First sign-in MFA setup  •  45 sec", font=sub_font, fill=(224, 242, 241))

    draw.rounded_rectangle((60, 180, 140, 260), radius=12, fill=TEAL)
    bbox = draw.textbbox((0, 0), segment["num"], font=step_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((100 - tw / 2, 220 - th / 2), segment["num"], font=step_font, fill=WHITE)
    draw.text((160, 195), segment["title"], font=head_font, fill=INK)

    lines = wrap_text(draw, segment["caption"], body_font, W - 120)
    y = 320
    for line in lines:
        draw.text((60, y), line, font=body_font, fill=SLATE)
        y += 42

    # Simple QR placeholder for step 2
    if segment["num"] == "2":
        qr_size = 180
        x0, y0 = W - qr_size - 80, H - qr_size - 90
        draw.rounded_rectangle((x0, y0, x0 + qr_size, y0 + qr_size), radius=8, fill=WHITE, outline=TEAL, width=3)
        cell = qr_size // 9
        for r in range(9):
            for c in range(9):
                if (r + c) % 2 == 0 or r in (0, 8) or c in (0, 8):
                    draw.rectangle(
                        (x0 + 12 + c * cell, y0 + 12 + r * cell, x0 + 12 + (c + 1) * cell, y0 + 12 + (r + 1) * cell),
                        fill=INK if (r * c) % 3 else TEAL,
                    )
        draw.text((x0, y0 + qr_size + 12), "Scan inside authenticator app", font=load_font(18), fill=SLATE)

    if segment["num"] == "3":
        draw.rounded_rectangle((60, H - 130, 420, H - 70), radius=10, fill=WHITE, outline=TEAL, width=2)
        draw.text((80, H - 118), "1 2 3 4 5 6", font=load_font(36, bold=True), fill=TEAL)
        draw.text((80, H - 78), "Enter code → Enable authenticator", font=load_font(20), fill=SLATE)

    return img


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def synth_voice(text: str, out_wav: Path) -> None:
    aiff = out_wav.with_suffix(".aiff")
    run(["say", "-v", "Samantha", "-r", "175", "-o", str(aiff), text])
    padded = out_wav.with_suffix(".pad.wav")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(aiff), "-ar", "44100", "-ac", "1", str(out_wav.with_suffix(".raw.wav"))])
    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(out_wav.with_suffix(".raw.wav")),
            "-af",
            "apad=pad_dur=0.8",
            str(out_wav),
        ]
    )


def build_segment(idx: int, segment: dict) -> Path:
    png = WORK / f"s{idx}.png"
    wav = WORK / f"s{idx}.wav"
    mp4 = WORK / f"s{idx}.mp4"
    render_slide(segment).save(png)
    synth_voice(segment["voice"], wav)
    dur = max(wav_duration(wav), 1.0)
    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-loop",
            "1",
            "-i",
            str(png),
            "-i",
            str(wav),
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-shortest",
            "-t",
            f"{dur:.3f}",
            str(mp4),
        ]
    )
    return mp4


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return float(out)


def main() -> int:
    if subprocess.call(["which", "ffmpeg"], stdout=subprocess.DEVNULL) != 0:
        print("ffmpeg is required", file=sys.stderr)
        return 1

    if WORK.exists():
        for p in WORK.iterdir():
            p.unlink()
    WORK.mkdir(parents=True, exist_ok=True)

    parts = [build_segment(i + 1, seg) for i, seg in enumerate(SEGMENTS)]
    list_file = WORK / "concat.txt"
    list_file.write_text("\n".join(f"file '{p}'" for p in parts) + "\n")
    combined = WORK / "combined.mp4"
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(combined)])

    duration = ffprobe_duration(combined)
    if duration > MAX_SECONDS + 0.05:
        speed = duration / MAX_SECONDS
        atempo = min(2.0, speed)
        # Chain atempo filters if needed (>2x)
        atempo_filters = []
        remaining = speed
        while remaining > 2.0:
            atempo_filters.append("atempo=2.0")
            remaining /= 2.0
        atempo_filters.append(f"atempo={remaining:.4f}")
        af = ",".join(atempo_filters)
        run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(combined),
                "-filter:v",
                f"setpts=PTS/{speed:.4f}",
                "-filter:a",
                af,
                "-t",
                str(MAX_SECONDS),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                str(OUT),
            ]
        )
    else:
        OUT.write_bytes(combined.read_bytes())

    final = ffprobe_duration(OUT)
    print(f"Wrote {OUT} ({final:.1f}s)")
    return 0 if final <= MAX_SECONDS + 0.25 else 1


if __name__ == "__main__":
    raise SystemExit(main())
