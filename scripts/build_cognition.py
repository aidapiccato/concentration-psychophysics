#!/usr/bin/env python3
"""
Bundles the task into a single file for cognition.run, which takes one main
JavaScript source rather than a folder of separate scripts:

  dist/index.js  =  css/style.css (injected as a <style> tag)
                  + every local <script src="js/..."> in index.html, in the
                    same order

Paste dist/index.js into cognition.run's code editor (or deploy it through
their GitHub integration). jsPsych itself and its CSS are provided by
cognition.run, so they aren't included; the plugins this task uses
(html-keyboard-response, instructions, preload) need to be available there
too -- check the editor's preview console if the task doesn't start.

Usage:
    python3 scripts/build_cognition.py
"""
import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def local_paths(html, tag_pattern):
    """Local (non-http) file paths referenced by tags matching tag_pattern, in document order."""
    paths = []
    for match in re.finditer(tag_pattern, html):
        path = match.group(1).split("?")[0]
        if not path.startswith(("http:", "https:", "//")):
            paths.append(path)
    return paths


def main():
    html = (PROJECT_ROOT / "index.html").read_text()
    script_paths = local_paths(html, r'<script[^>]*\ssrc="([^"]+)"')
    css_paths = local_paths(html, r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"')

    parts = [
        "// Bundled by scripts/build_cognition.py -- edit the files under js/ and css/, not this one.\n"
    ]
    for css_path in css_paths:
        css = (PROJECT_ROOT / css_path).read_text()
        parts.append(
            f"// ---- {css_path} ----\n"
            "(function () {\n"
            '  const style = document.createElement("style");\n'
            f"  style.textContent = {json.dumps(css)};\n"
            "  document.head.appendChild(style);\n"
            "})();\n"
        )
    # The scripts are wrapped in one function so that (a) their top-level
    # const/let/function declarations (EXPERIMENT_CONFIG, isLocalDev, ...)
    # never land in the page's global scope, and (b) if the host evaluates this
    # bundle twice in the same page, the second run exits instead of throwing
    # "Identifier 'EXPERIMENT_CONFIG' has already been declared" -- or worse,
    # starting a second copy of the task.
    parts.append(
        "(function () {\n"
        "  if (window.__memoryTaskBundleLoaded) {\n"
        '    console.warn("Task bundle already loaded in this page; skipping the second load.");\n'
        "    return;\n"
        "  }\n"
        "  window.__memoryTaskBundleLoaded = true;\n"
    )
    for script_path in script_paths:
        parts.append(f"// ---- {script_path} ----\n" + (PROJECT_ROOT / script_path).read_text())
    parts.append("})();\n")

    out = PROJECT_ROOT / "dist" / "index.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(parts))
    print(
        f"{out.relative_to(PROJECT_ROOT)}: {len(css_paths)} css + {len(script_paths)} scripts, "
        f"{out.stat().st_size / 1024:.0f} KB"
    )
    for path in css_paths + script_paths:
        print(f"  {path}")


if __name__ == "__main__":
    main()
