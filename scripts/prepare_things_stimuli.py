#!/usr/bin/env python3
"""
Turns a folder of downloaded THINGS(plus) images into what the memory task
expects: assets/images/manifest.json plus a flat copy of the images
themselves in assets/images/.

Handles two common layouts for the downloaded/extracted images:
  - one subfolder per concept, e.g. images/aardvark/aardvark_01b.jpg
  - a flat folder of files named like aardvark_01b.jpg or aardvark.jpg

Only the first image found per concept is kept (the task uses one image per
concept), so if you downloaded the multi-exemplar academic-use bundle
instead of the single-exemplar THINGSplus CC0 set, this will pick whichever
exemplar it encounters first per concept, sorted alphabetically by file path.

Usage:
    python3 scripts/prepare_things_stimuli.py /path/to/downloaded/things/images
"""
import json
import re
import shutil
import sys
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
TRAILING_EXEMPLAR_SUFFIX = re.compile(r"[_\-]+[0-9][0-9a-zA-Z]*$")


def concept_from_path(path, source_root):
    rel_parts = path.relative_to(source_root).parts
    if len(rel_parts) > 1:
        # Nested under a per-concept folder — the folder name is the concept.
        concept = rel_parts[0]
    else:
        # Flat layout — strip a trailing exemplar number/suffix from the
        # filename, e.g. "aardvark_01b" -> "aardvark".
        concept = TRAILING_EXEMPLAR_SUFFIX.sub("", path.stem)
    return concept.replace("_", " ").replace("-", " ").strip().lower()


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/prepare_things_stimuli.py /path/to/things/images")
        sys.exit(1)

    source_root = Path(sys.argv[1]).expanduser().resolve()
    if not source_root.is_dir():
        print(f"Not a directory: {source_root}")
        sys.exit(1)

    project_root = Path(__file__).resolve().parent.parent
    dest_dir = project_root / "assets" / "images"
    dest_dir.mkdir(parents=True, exist_ok=True)

    image_paths = sorted(
        p for p in source_root.rglob("*") if p.suffix.lower() in IMAGE_EXTENSIONS
    )
    if not image_paths:
        print(f"No image files found under {source_root}")
        sys.exit(1)

    manifest = []
    seen_concepts = set()
    for path in image_paths:
        concept = concept_from_path(path, source_root)
        if concept in seen_concepts:
            continue
        seen_concepts.add(concept)

        dest_name = f"{path.stem}{path.suffix.lower()}"
        shutil.copy2(path, dest_dir / dest_name)
        manifest.append({"concept": concept, "file": dest_name})

    manifest.sort(key=lambda entry: entry["concept"])
    manifest_path = dest_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"Copied {len(manifest)} images to {dest_dir}")
    print(f"Wrote manifest: {manifest_path}")
    print("Sanity-check a few entries in manifest.json — concept names are")
    print("inferred from folder/file names and this script can't verify")
    print("against the real THINGS concept list.")


if __name__ == "__main__":
    main()
