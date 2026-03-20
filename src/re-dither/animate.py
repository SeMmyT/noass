#!/usr/bin/env python3
"""RE_DITHER animate — generate dithered animation frames then ffmpeg into video.

Modes:
  materialize   aggression sweeps 90→0 (ghost appears from nothing)
  dissolve      aggression sweeps 0→90 (ghost fades into void)
  breathe       aggression oscillates 10→50→10 (pulsing)
  tint-shift    cycles through denim→gold→ember→moss→denim
  sweep         horizontal wipe from destroyed to original

Usage:
  python3 animate.py <input.png> --mode materialize --duration 10 --fps 30
  python3 animate.py <input.png> --mode tint-shift -t 10 --fps 24
  python3 animate.py <input.png> --mode breathe --loop
"""

import argparse
import math
import os
import shutil
import subprocess
import sys
import tempfile

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow required", file=sys.stderr)
    sys.exit(1)


TINT_PRESETS = {
    "none":  (1.0, 1.0, 1.05),
    "denim": (0.4, 0.45, 1.3),
    "gold":  (1.4, 1.0, 0.3),
    "ember": (1.4, 0.5, 0.3),
    "moss":  (0.4, 1.0, 0.45),
}

TINT_CYCLE = ["denim", "gold", "ember", "moss"]


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_tint(tint_a, tint_b, t):
    return tuple(lerp(a, b, t) for a, b in zip(tint_a, tint_b))


def destroy_frame(data, aggression, tint, width=0, sweep_x=-1):
    """Destroy a single frame. If sweep_x >= 0, only destroy pixels left of sweep_x."""
    thresh = 255 - int(aggression * 0.8)
    dark_floor = max(10, 60 - int(aggression * 0.5))
    dark_ceil = max(25, 80 - int(aggression * 0.5))
    rm, gm, bm = tint

    new_data = []
    for i, (r, g, b, a) in enumerate(data):
        # Sweep mode: only destroy pixels left of the sweep line
        if sweep_x >= 0 and width > 0:
            px = i % width
            if px > sweep_x:
                new_data.append((r, g, b, a))
                continue

        brightness = (r + g + b) / 3
        if brightness > thresh:
            t = (brightness - thresh) / (255 - thresh) if thresh < 255 else 0
            base = int(dark_floor + t * (dark_ceil - dark_floor))
            nr = max(0, min(255, int(base * rm)))
            ng = max(0, min(255, int(base * gm)))
            nb = max(0, min(255, int(base * bm)))
            new_data.append((nr, ng, nb, a))
        else:
            new_data.append((r, g, b, a))

    return new_data


def generate_frames(input_path, mode, duration, fps, tint_name, loop):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    data = list(img.getdata())
    total_frames = int(duration * fps)

    if loop and mode in ("materialize", "dissolve"):
        # Double: forward + reverse
        half = total_frames // 2
    else:
        half = total_frames

    tmpdir = tempfile.mkdtemp(prefix="redither_")
    base_tint = TINT_PRESETS.get(tint_name, TINT_PRESETS["none"])

    print(f"RE_DITHER animate // {mode}")
    print(f"  frames: {total_frames} ({duration}s @ {fps}fps)")
    print(f"  tint:   {tint_name}")
    print(f"  size:   {w}x{h}")
    print(f"  tmpdir: {tmpdir}")

    frames = []
    for i in range(total_frames):
        t = i / max(total_frames - 1, 1)

        if mode == "materialize":
            if loop:
                # Triangle wave: 0→1→0
                t2 = 1 - abs(2 * t - 1)
                agg = 90 - t2 * 80  # 90→10→90
            else:
                agg = 90 - t * 80  # 90→10
            tint = base_tint

        elif mode == "dissolve":
            if loop:
                t2 = 1 - abs(2 * t - 1)
                agg = 10 + t2 * 80
            else:
                agg = 10 + t * 80  # 10→90
            tint = base_tint

        elif mode == "breathe":
            # Sinusoidal breathing
            agg = 10 + 40 * (0.5 + 0.5 * math.sin(t * math.pi * 4))  # 10→50→10, 2 full cycles
            tint = base_tint

        elif mode == "tint-shift":
            # Cycle through 4 tints
            cycle_pos = t * len(TINT_CYCLE)
            idx = int(cycle_pos) % len(TINT_CYCLE)
            next_idx = (idx + 1) % len(TINT_CYCLE)
            frac = cycle_pos - int(cycle_pos)
            tint = lerp_tint(TINT_PRESETS[TINT_CYCLE[idx]], TINT_PRESETS[TINT_CYCLE[next_idx]], frac)
            agg = 10  # low aggression to see color

        elif mode == "sweep":
            sweep_x = int(t * w)
            agg = 70
            tint = base_tint
            new_data = destroy_frame(data, agg, tint, width=w, sweep_x=sweep_x)
            frame = img.copy()
            frame.putdata(new_data)
            frame_path = os.path.join(tmpdir, f"frame_{i:05d}.png")
            frame.save(frame_path)
            frames.append(frame_path)
            if (i + 1) % (total_frames // 10) == 0:
                print(f"  [{i+1}/{total_frames}]")
            continue

        else:
            agg = 50
            tint = base_tint

        new_data = destroy_frame(data, agg, tint)
        frame = img.copy()
        frame.putdata(new_data)
        frame_path = os.path.join(tmpdir, f"frame_{i:05d}.png")
        frame.save(frame_path)
        frames.append(frame_path)

        if (i + 1) % max(1, total_frames // 10) == 0:
            print(f"  [{i+1}/{total_frames}]")

    return tmpdir, frames, total_frames


def frames_to_video(tmpdir, output, fps, loop_count=0):
    """ffmpeg PNG sequence → MP4 (h264) or GIF."""
    ext = os.path.splitext(output)[1].lower()
    pattern = os.path.join(tmpdir, "frame_%05d.png")

    if ext == ".gif":
        cmd = [
            "ffmpeg", "-y", "-framerate", str(fps),
            "-i", pattern,
            "-vf", "split[s0][s1];[s0]palettegen=max_colors=32[p];[s1][p]paletteuse=dither=bayer",
            "-loop", str(loop_count),
            output,
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-framerate", str(fps),
            "-i", pattern,
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output,
        ]

    print(f"  encoding: {' '.join(cmd[:6])}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[:500]}", file=sys.stderr)
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="RE_DITHER animate — dithered animation loops")
    parser.add_argument("input", help="Source image")
    parser.add_argument("-m", "--mode", default="materialize",
                        choices=["materialize", "dissolve", "breathe", "tint-shift", "sweep"],
                        help="Animation mode")
    parser.add_argument("-d", "--duration", type=float, default=10, help="Duration in seconds")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("-t", "--tint", default="none", help="Base tint (denim/gold/ember/moss/none)")
    parser.add_argument("--loop", action="store_true", help="Ping-pong loop (forward+reverse)")
    parser.add_argument("-o", "--output", help="Output video path (default: <input>-<mode>.mp4)")
    parser.add_argument("--gif", action="store_true", help="Output as GIF instead of MP4")
    parser.add_argument("--keep-frames", action="store_true", help="Keep frame PNGs after encoding")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    if args.output:
        out = args.output
    else:
        base = os.path.splitext(args.input)[0]
        ext = ".gif" if args.gif else ".mp4"
        out = f"{base}-{args.mode}{ext}"

    tmpdir, frames, total = generate_frames(
        args.input, args.mode, args.duration, args.fps, args.tint, args.loop
    )

    success = frames_to_video(tmpdir, out, args.fps, loop_count=0 if args.loop else -1)

    if not args.keep_frames:
        shutil.rmtree(tmpdir)

    if success:
        size = os.path.getsize(out)
        print(f"\n  output: {out} ({size/1024:.0f}KB)")
    else:
        print("\n  FAILED", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
