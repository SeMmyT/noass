#!/usr/bin/env python3
"""Generate dithered images for NOASS PDF via Imagen 4.0 API."""

import base64
import json
import os
import sys
import urllib.request

API_KEY = os.environ["GEMINI_API_KEY"]
OUT_DIR = os.path.join(os.path.dirname(__file__), "assets")

# Imagen 4.0 endpoint
IMAGEN_MODEL = "imagen-4.0-generate-001"
IMAGEN_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{IMAGEN_MODEL}:predict?key={API_KEY}"

IMAGES = [
    {
        "name": "noass-logo",
        "prompt": (
            "A minimalist, stylized logo icon for an app called '#0A55'. "
            "The icon features a stylized, geometric crossed-out peach/butt emoji shape — two overlapping circles "
            "with a diagonal cross/slash through them, forming a 'prohibited' symbol. "
            "Pure black and white, 1-bit dithered aesthetic like a 1988 Macintosh icon. "
            "Floyd-Steinberg dithering pattern visible. No gradients — only pure black and white pixels. "
            "Below the icon, the text '#0A55' in a bold monospace font. "
            "Square format, clean black background, high contrast."
        ),
        "aspect": "1:1",
    },
    {
        "name": "noass-banner",
        "prompt": (
            "A wide banner image in Satisfactory game blueprint/industrial documentation style. "
            "1-bit dithered aesthetic — pure black and white pixels only, Floyd-Steinberg dithering. "
            "Shows a network visualization: 7 circular nodes connected by dotted lines, like a force-directed graph. "
            "Some nodes are bright (alive), some are dark (dead). Each node has a progress ring around it. "
            "CRT scanlines visible. A stats bar at top showing 'ALIVE: 5 DEAD: 2 CTX: 1,234k'. "
            "Retro terminal aesthetic, monospace font, green phosphor glow accent on black."
        ),
        "aspect": "3:1",
    },
    {
        "name": "noass-skins-preview",
        "prompt": (
            "A grid showing 6 different color theme previews for a terminal/screensaver app. "
            "Each cell shows the same circular node graph but with a different accent color: "
            "1) Matrix green, 2) Amber, 3) Ice blue, "
            "4) Blood red, 5) Phantom violet, 6) Solar orange. "
            "Each on pure black background with 1-bit dithered nodes and CRT scanlines. "
            "Clean grid layout, 3x2. Each cell labeled with the skin name below. "
            "Retro computer aesthetic, like choosing a theme in a 1990s screen saver settings dialog."
        ),
        "aspect": "4:3",
    },
    {
        "name": "noass-architecture",
        "prompt": (
            "A technical architecture diagram in 1-bit dithered retro style. "
            "Shows: Phone icon on left labeled 'NOASS App' connected via a zigzag line labeled 'WebSocket' "
            "to a server box on right labeled 'Host Server'. "
            "The server has arrows pointing to a terminal icon labeled 'Agent Runtime'. "
            "Below the phone, show 3 smaller icons: a paint palette (Skins), a shopping bag (Marketplace), "
            "and a gear (Settings). "
            "Pure black and white, dithered shading, monospace labels, technical blueprint feel. "
            "Satisfactory game documentation style — industrial, clean, precise."
        ),
        "aspect": "16:9",
    },
    {
        "name": "noass-marketplace",
        "prompt": (
            "A mobile app screenshot mockup showing a 'Skin Marketplace' screen. "
            "Dark black background, retro terminal aesthetic. "
            "At top: 'MARKETPLACE' in dithered monospace text with green accent. "
            "Below: a horizontal row of 'Featured' skin cards — each card is a small square showing "
            "a different colored node graph preview (green, amber, blue, red, purple, orange). "
            "Below that: a grid of all skins with name, author, and an 'Apply' button. "
            "1-bit dithered aesthetic throughout — Floyd-Steinberg dithering, CRT scanlines, "
            "no gradients, pure black and white with one accent color (green). "
            "Mobile phone portrait aspect ratio."
        ),
        "aspect": "9:16",
    },
]


def generate_imagen(prompt: str, name: str, aspect: str = "1:1") -> str | None:
    """Call Imagen 4.0 API to generate an image, save as PNG."""
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": aspect,
            "outputOptions": {"mimeType": "image/png"},
        },
    }

    req = urllib.request.Request(
        IMAGEN_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        if hasattr(e, "read"):
            err_body = e.read().decode("utf-8", errors="replace")[:500]
            print(f"  Body: {err_body}", file=sys.stderr)
        return None

    # Imagen returns predictions[].bytesBase64Encoded
    predictions = data.get("predictions", [])
    if not predictions:
        print(f"  No predictions in response", file=sys.stderr)
        print(f"  Keys: {list(data.keys())}", file=sys.stderr)
        if "error" in data:
            print(f"  Error: {json.dumps(data['error'])[:500]}", file=sys.stderr)
        return None

    for i, pred in enumerate(predictions):
        b64 = pred.get("bytesBase64Encoded")
        if not b64:
            continue
        raw = base64.b64decode(b64)
        out_path = os.path.join(OUT_DIR, f"{name}.png")
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"  Saved: {out_path} ({len(raw)} bytes)")
        return out_path

    print(f"  No image data in predictions", file=sys.stderr)
    return None


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    results = []
    for img in IMAGES:
        print(f"Generating: {img['name']} ({img['aspect']})...")
        path = generate_imagen(img["prompt"], img["name"], img.get("aspect", "1:1"))
        results.append((img["name"], path))

    print("\n=== Results ===")
    for name, path in results:
        status = path if path else "FAILED"
        print(f"  {name}: {status}")


if __name__ == "__main__":
    main()
