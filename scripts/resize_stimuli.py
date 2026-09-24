#!/usr/bin/env python3
"""
Writes a downsized copy of the stimulus images (plus manifest.json) to a
separate folder, leaving the full-size originals untouched. The task shows
images at ~100-110px, so the ~1600px originals are far more than a
participant's browser needs to download.

Usage:
    python3 scripts/resize_stimuli.py                    # 256px -> assets/images_small/
    python3 scripts/resize_stimuli.py --size 200 --out assets/images_tiny
"""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", default="assets/images", help="folder with manifest.json and the full-size images")
    parser.add_argument("--out", default="assets/images_small", help="folder to write the resized copy to")
    parser.add_argument("--size", type=int, default=256, help="longest side of each output image, in px")
    parser.add_argument("--quality", type=int, default=85, help="JPEG quality (1-95)")
    args = parser.parse_args()

    src = PROJECT_ROOT / args.src
    out = PROJECT_ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)

    manifest = json.loads((src / "manifest.json").read_text())
    total_before = total_after = 0
    for i, entry in enumerate(manifest, 1):
        source_path = src / entry["file"]
        target_path = out / entry["file"]
        with Image.open(source_path) as im:
            im = im.convert("RGB")
            # Never upscales: a source already smaller than --size is kept at its size.
            im.thumbnail((args.size, args.size), Image.LANCZOS)
            im.save(target_path, "JPEG", quality=args.quality, optimize=True)
        total_before += source_path.stat().st_size
        total_after += target_path.stat().st_size
        if i % 200 == 0:
            print(f"  {i}/{len(manifest)}")

    shutil.copyfile(src / "manifest.json", out / "manifest.json")
    print(
        f"{len(manifest)} images -> {out.relative_to(PROJECT_ROOT)}: "
        f"{total_before / 1e6:.0f} MB -> {total_after / 1e6:.0f} MB "
        f"({100 * total_after / total_before:.1f}%)"
    )


if __name__ == "__main__":
    main()
