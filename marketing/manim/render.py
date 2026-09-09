"""Render a manim scene to TRANSPARENT frames Remotion can actually composite.

    .venv/Scripts/python.exe render.py Funnel
    .venv/Scripts/python.exe render.py Funnel --quality l

WHY A FRAME SEQUENCE AND NOT A VIDEO FILE. Three routes were tried live and two
of them fail SILENTLY — they accept the transparency flag, print no warning, and
write a file whose corner pixel is the opaque background colour. Composited over
anything, that is a solid rectangle.

  manim -t --format=webm   pix_fmt yuv420p, corner alpha 255.  NO ALPHA.
  manim -t --format=mov    pix_fmt argb,    corner alpha 0.    Real alpha, but
                           qtrle, which no browser can decode — so Remotion
                           cannot use it either.
  MOV -> VP9/VP8 WebM      Both encoders LIST yuva420p as supported and both
                           write yuv420p anyway, with an explicit
                           `-vf format=yuva420p` and `-auto-alt-ref 0`. WebM
                           alpha lives in a separate BlockAdditions track this
                           ffmpeg build does not produce.
  manim -t --format=png    pix_fmt rgba, corner alpha 0, content alpha real.
                           ~12 MB for 233 frames at 1080x1920.

So: PNG frames. Lossless, browser-native, and — the part that matters — every
step of it can be checked. This script checks it rather than trusting it, on
several frames rather than one, because the failures above all look correct
until a pixel is actually read.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SCENES = ROOT / "scenes"
WORK = ROOT / ".work"

# Where Remotion picks the frames up. Film assets, not site assets.
REMOTION_PUBLIC = ROOT.parent / "video" / "public" / "manim"

FPS = {"l": 15, "m": 30, "h": 60, "p": 60, "k": 60}


def find_scene_file(scene: str) -> Path:
    """Locate the module defining a scene class, by reading rather than guessing."""
    for f in sorted(SCENES.glob("*.py")):
        if f"class {scene}(" in f.read_text(encoding="utf-8"):
            return f
    raise SystemExit(f"no scene class named {scene} under {SCENES}")


def corner_alpha(path: Path, x: int = 0, y: int = 0) -> int | None:
    """Alpha of one pixel of a frame. 0 is transparent, 255 opaque."""
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"crop=2:2:{x}:{y},format=rgba",
         "-frames:v", "1", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    if r.returncode != 0 or len(r.stdout) < 4:
        return None
    return r.stdout[3]


def pix_fmt(path: Path) -> str:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    return r.stdout.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--quality", default="m", choices=list(FPS))
    ap.add_argument("--keep-work", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("ffmpeg and ffprobe must be on PATH")

    scene_file = find_scene_file(args.scene)
    print(f"scene {args.scene} in {scene_file.name}, quality {args.quality}")

    shutil.rmtree(WORK, ignore_errors=True)
    WORK.mkdir(parents=True, exist_ok=True)

    print("\n1. manim -> transparent PNG frames")
    r = subprocess.run([
        sys.executable, "-m", "manim", "render",
        f"-q{args.quality}", "--format=png", "-t",
        "--media_dir", str(WORK),
        str(scene_file), args.scene,
    ], capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit("manim failed")

    frames = sorted(WORK.rglob(f"{args.scene}[0-9]*.png"))
    if not frames:
        raise SystemExit("manim produced no frames")
    print(f"   {len(frames)} frames")

    print("\n2. verifying the alpha actually survived")
    fmt = pix_fmt(frames[0])
    if fmt != "rgba":
        raise SystemExit(f"FAIL: frames are {fmt}, not rgba — they carry no alpha channel.")

    # Several frames, not one: an empty opening frame is transparent whatever
    # went wrong, so the check has to reach a frame that has content on it.
    sample = [frames[0], frames[len(frames) // 2], frames[-1]]
    for f in sample:
        a = corner_alpha(f)
        if a != 0:
            raise SystemExit(
                f"FAIL: {f.name} has corner alpha {a}, not 0. The background is being drawn, "
                "so this would composite as a solid rectangle."
            )
    print(f"   pix_fmt=rgba, corner alpha 0 on frames "
          f"{', '.join(f.stem[-4:] for f in sample)}")

    # And SOMETHING must be drawn, or a scene that silently rendered nothing
    # would sail through a transparency check by being entirely transparent.
    mid = frames[len(frames) // 2]
    drawn = corner_alpha(mid, x=520, y=380)
    if drawn is None or drawn == 0:
        raise SystemExit(
            f"FAIL: {mid.name} is transparent in the middle of the frame too — the scene rendered "
            "nothing, and an empty clip passes a transparency check trivially."
        )
    print(f"   content present: centre alpha {drawn}")

    print("\n3. publishing to the Remotion asset tree")
    dest = REMOTION_PUBLIC / args.scene
    shutil.rmtree(dest, ignore_errors=True)
    dest.mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(frames):
        shutil.copy2(f, dest / f"{i:05d}.png")

    fps = FPS[args.quality]
    manifest = {
        "scene": args.scene,
        "frames": len(frames),
        "fps": fps,
        "durationSeconds": round(len(frames) / fps, 3),
        "width": 1080,
        "height": 1920,
        "pattern": "%05d.png",
    }
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    size = sum(p.stat().st_size for p in dest.glob("*.png"))
    print(f"   {dest.relative_to(ROOT.parent.parent)} — {len(frames)} frames, "
          f"{size / 1e6:.1f} MB, {manifest['durationSeconds']}s at {fps}fps")

    if not args.keep_work:
        shutil.rmtree(WORK, ignore_errors=True)

    print("\nOK — alpha verified on three frames, content verified on one.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
