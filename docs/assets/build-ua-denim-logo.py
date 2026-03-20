#!/usr/bin/env python3
"""Woven dual-colour denim NOASS logo in Ukrainian flag colours."""

import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path

ASSETS = Path(__file__).parent

# UA colors
BLUE_WARP = np.array([0, 87, 183], dtype=np.uint8)      # blue thread
YELLOW_WEFT = np.array([255, 215, 0], dtype=np.uint8)    # yellow thread
BLUE_SHADOW = np.array([0, 55, 130], dtype=np.uint8)     # blue in shadow
YELLOW_SHADOW = np.array([200, 170, 0], dtype=np.uint8)  # yellow in shadow


def make_twill_weave(w, h, thread_w=4, pattern='twill_3_1'):
    """
    Generate a twill weave pattern.
    Returns two masks: warp_visible (blue on top) and weft_visible (yellow on top).
    Twill 3/1 gives that classic diagonal denim weave.
    """
    warp_top = np.zeros((h, w), dtype=bool)

    for y in range(h):
        for x in range(w):
            # Which thread position
            tx = x // thread_w
            ty = y // thread_w

            if pattern == 'twill_3_1':
                # 3/1 twill: warp floats over 3, under 1, shifted each row
                phase = (tx + ty) % 4
                warp_top[y, x] = phase != 0  # warp on top 3 out of 4

            elif pattern == 'twill_2_2':
                # 2/2 twill: balanced, more yellow visible
                phase = (tx + ty) % 4
                warp_top[y, x] = phase < 2

    return warp_top, ~warp_top


def apply_weave_texture(img_arr, warp_mask, weft_mask, thread_w=4):
    """Apply woven denim texture with thread-level shading."""
    h, w = warp_mask.shape
    out = np.zeros((h, w, 3), dtype=np.uint8)

    # Base colors
    out[warp_mask] = BLUE_WARP
    out[weft_mask] = YELLOW_WEFT

    # Thread-level variation: add subtle brightness noise per thread
    rng = np.random.RandomState(42)
    for y in range(0, h, thread_w):
        for x in range(0, w, thread_w):
            y2 = min(y + thread_w, h)
            x2 = min(x + thread_w, w)
            # Random brightness variation per thread crossing
            var = rng.randint(-15, 15)
            out[y:y2, x:x2] = np.clip(out[y:y2, x:x2].astype(np.int16) + var, 0, 255).astype(np.uint8)

    # Add diagonal twill shadow lines
    for y in range(h):
        for x in range(w):
            # Shadow at thread boundaries (where warp dips under weft)
            tx = x // thread_w
            ty = y // thread_w
            # Edge of thread crossing — darken slightly
            local_x = x % thread_w
            local_y = y % thread_w
            if local_x == 0 or local_y == 0:
                out[y, x] = np.clip(out[y, x].astype(np.int16) - 20, 0, 255).astype(np.uint8)

    return out


def weave_logo(logo_gray, size, thread_w=4):
    """
    Create woven denim logo.
    Where logo is light: yellow weft dominates (yellow thread on top).
    Where logo is dark: blue warp dominates (blue thread on top).
    Creates a fabric where the pattern emerges from which thread is on top.
    """
    h, w = size

    # Generate base twill
    warp_base, weft_base = make_twill_weave(w, h, thread_w, 'twill_3_1')

    # Logo mask — normalized 0..1
    logo_resized = logo_gray.resize((w, h), Image.LANCZOS)
    logo_arr = np.array(logo_resized).astype(np.float64) / 255.0

    # Where logo is bright (>0.5): force yellow on top (weft visible)
    # Where logo is dark (<0.5): force blue on top (warp visible)
    # In between: use the natural twill pattern
    logo_threshold_high = logo_arr > 0.6
    logo_threshold_low = logo_arr < 0.3
    logo_mid = ~logo_threshold_high & ~logo_threshold_low

    warp_visible = np.copy(warp_base)
    weft_visible = np.copy(weft_base)

    # Logo bright areas: mostly yellow on top
    warp_visible[logo_threshold_high] = False
    weft_visible[logo_threshold_high] = True

    # Logo dark areas: mostly blue on top
    warp_visible[logo_threshold_low] = True
    weft_visible[logo_threshold_low] = False

    # Mid-tones: blend with twill (this creates the denim texture in transition areas)
    # Use probability based on logo brightness
    rng = np.random.RandomState(7)
    mid_mask = logo_mid
    mid_brightness = logo_arr[mid_mask]
    # Higher brightness = more likely yellow on top
    yellow_chance = rng.random(mid_brightness.shape) < mid_brightness
    warp_visible[mid_mask] = ~yellow_chance
    weft_visible[mid_mask] = yellow_chance

    # Build the woven image
    out = np.zeros((h, w, 3), dtype=np.uint8)

    # Thread-level rendering with shading
    rng2 = np.random.RandomState(42)
    for y in range(0, h, thread_w):
        for x in range(0, w, thread_w):
            y2 = min(y + thread_w, h)
            x2 = min(x + thread_w, w)
            block_warp = warp_visible[y:y2, x:x2]
            block_weft = weft_visible[y:y2, x:x2]

            # Thread brightness variation
            var = rng2.randint(-12, 12)

            # The thread on top gets full color, thread below gets shadow
            for by in range(y, y2):
                for bx in range(x, x2):
                    if by < h and bx < w:
                        if warp_visible[by, bx]:
                            base = BLUE_WARP.astype(np.int16)
                        else:
                            base = YELLOW_WEFT.astype(np.int16)

                        # Thread edge darkening
                        local_x = bx % thread_w
                        local_y = by % thread_w
                        edge_dark = 0
                        if local_x == 0 or local_x == thread_w - 1:
                            edge_dark -= 18
                        if local_y == 0 or local_y == thread_w - 1:
                            edge_dark -= 12

                        out[by, bx] = np.clip(base + var + edge_dark, 0, 255).astype(np.uint8)

    return out


def build_logos():
    # Load the raw logo
    logo_path = ASSETS / "noass-logo-raw.png"
    logo = Image.open(logo_path).convert('L')
    print(f"Source logo: {logo.size}")

    sizes = [
        ("noass-logo-ua-denim-512", (512, 512), 3),
        ("noass-logo-ua-denim-1024", (1024, 1024), 4),
        ("noass-logo-ua-denim-2048", (2048, 2048), 6),
    ]

    for name, size, thread_w in sizes:
        print(f"Weaving {name} ({size[0]}px, thread={thread_w}px)...")
        woven = weave_logo(logo, size, thread_w)
        img = Image.fromarray(woven, mode='RGB')

        # Subtle fabric texture: tiny gaussian blur to soften thread edges
        img = img.filter(ImageFilter.GaussianBlur(radius=0.3))

        out_path = ASSETS / f"{name}.png"
        img.save(str(out_path), dpi=(300, 300))
        print(f"  -> {out_path} ({out_path.stat().st_size // 1024} KB)")

    # Also make a version with the twill inverted (2/2 balanced weave — more yellow)
    print("Weaving balanced variant (2/2 twill)...")
    logo_gray = Image.open(logo_path).convert('L')
    h, w = 1024, 1024
    warp_base, weft_base = make_twill_weave(w, h, 4, 'twill_2_2')
    logo_resized = logo_gray.resize((w, h), Image.LANCZOS)
    logo_arr = np.array(logo_resized).astype(np.float64) / 255.0

    warp_visible = np.copy(warp_base)
    weft_visible = np.copy(weft_base)
    warp_visible[logo_arr > 0.6] = False
    weft_visible[logo_arr > 0.6] = True
    warp_visible[logo_arr < 0.3] = True
    weft_visible[logo_arr < 0.3] = False

    rng = np.random.RandomState(7)
    mid = (logo_arr >= 0.3) & (logo_arr <= 0.6)
    yellow_chance = rng.random(logo_arr[mid].shape) < logo_arr[mid]
    warp_visible[mid] = ~yellow_chance
    weft_visible[mid] = yellow_chance

    out = np.zeros((h, w, 3), dtype=np.uint8)
    rng2 = np.random.RandomState(42)
    tw = 4
    for y in range(0, h, tw):
        for x in range(0, w, tw):
            var = rng2.randint(-12, 12)
            for by in range(y, min(y + tw, h)):
                for bx in range(x, min(x + tw, w)):
                    base = BLUE_WARP.astype(np.int16) if warp_visible[by, bx] else YELLOW_WEFT.astype(np.int16)
                    edge_dark = 0
                    if bx % tw == 0 or bx % tw == tw - 1:
                        edge_dark -= 18
                    if by % tw == 0 or by % tw == tw - 1:
                        edge_dark -= 12
                    out[by, bx] = np.clip(base + var + edge_dark, 0, 255).astype(np.uint8)

    img = Image.fromarray(out, mode='RGB').filter(ImageFilter.GaussianBlur(radius=0.3))
    bal_path = ASSETS / "noass-logo-ua-denim-balanced.png"
    img.save(str(bal_path), dpi=(300, 300))
    print(f"  -> {bal_path} ({bal_path.stat().st_size // 1024} KB)")

    print("\nDone! All UA denim logos generated.")


if __name__ == '__main__':
    build_logos()
