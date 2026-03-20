// ── renderer.ts — Core Dither Engine ─────────────────────────────────────────
// Everything visual passes through Floyd-Steinberg. 1-bit. Heavy. 1988 Mac.

import type { Skin } from "./types";

export function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

// ── Floyd-Steinberg Dithering ────────────────────────────────────────────────
// Operates on grayscale imageData (R=G=B). Produces pure B&W (0 or 255).
export function floydSteinbergDither(imageData: ImageData): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const old = data[i];
      const val = old > 128 ? 255 : 0;
      const err = old - val;
      data[i] = data[i + 1] = data[i + 2] = val;
      if (x + 1 < w) {
        const j = i + 4;
        data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 7) / 16);
      }
      if (y + 1 < h) {
        if (x > 0) {
          const j = ((y + 1) * w + (x - 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 3) / 16);
        }
        {
          const j = ((y + 1) * w + x) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 5) / 16);
        }
        if (x + 1 < w) {
          const j = ((y + 1) * w + (x + 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 1) / 16);
        }
      }
    }
  }
  return imageData;
}

// ── Dithered Text Cache ──────────────────────────────────────────────────────
const _textCache = new Map<string, { canvas: HTMLCanvasElement; width: number; height: number }>();
const _TEXT_CACHE_MAX = 512;

function _textCacheKey(text: string, fontSize: number, color: string, bold: boolean): string {
  return `${text}|${fontSize}|${color}|${bold ? 1 : 0}`;
}

export function clearTextCache(): void {
  _textCache.clear();
}

// ── Draw Dithered Text ───────────────────────────────────────────────────────
export function drawDitheredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  options: { color?: "white" | "accent"; bold?: boolean; align?: "left" | "center" | "right" },
  skin: Skin
): void {
  const opts = { color: "white" as const, bold: false, align: "left" as const, ...options };
  const key = _textCacheKey(text, fontSize, opts.color, opts.bold);

  let cached = _textCache.get(key);
  if (!cached) {
    const weight = opts.bold ? "700" : "400";
    const font = `${weight} ${fontSize}px '${skin.fontFamily}', monospace`;

    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = font;
    const metrics = measure.measureText(text);
    const tw = Math.ceil(metrics.width) + 4;
    const th = Math.ceil(fontSize * 1.4) + 4;

    const off = document.createElement("canvas");
    off.width = tw;
    off.height = th;
    const offCtx = off.getContext("2d")!;

    offCtx.fillStyle = "#000";
    offCtx.fillRect(0, 0, tw, th);

    const gray = opts.color === "accent" ? 255 : 200;
    offCtx.fillStyle = `rgb(${gray},${gray},${gray})`;
    offCtx.font = font;
    offCtx.textBaseline = "top";
    offCtx.fillText(text, 2, 2);

    const imgData = offCtx.getImageData(0, 0, tw, th);
    floydSteinbergDither(imgData);

    if (opts.color === "accent") {
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 255) {
          d[i] = skin.accentRGB.r;
          d[i + 1] = skin.accentRGB.g;
          d[i + 2] = skin.accentRGB.b;
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    cached = { canvas: off, width: tw, height: th };
    if (_textCache.size > _TEXT_CACHE_MAX) {
      _textCache.delete(_textCache.keys().next().value!);
    }
    _textCache.set(key, cached);
  }

  let dx = x;
  if (opts.align === "center") dx = x - cached.width / 2;
  else if (opts.align === "right") dx = x - cached.width;

  ctx.drawImage(cached.canvas, Math.round(dx), Math.round(y - fontSize * 0.7));
}

// ── Draw Dithered Circle ─────────────────────────────────────────────────────
const _circleCache = new Map<string, { canvas: HTMLCanvasElement; size: number }>();
const _CIRCLE_CACHE_MAX = 128;

export function clearCircleCache(): void {
  _circleCache.clear();
}

export function drawDitheredCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fillGray: number
): void {
  const r = Math.ceil(radius);
  const size = r * 2 + 4;
  const key = `${r}|${fillGray}`;

  let cached = _circleCache.get(key);
  if (!cached) {
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const offCtx = off.getContext("2d")!;

    offCtx.fillStyle = "#000";
    offCtx.fillRect(0, 0, size, size);

    const center = size / 2;
    offCtx.beginPath();
    offCtx.arc(center, center, r, 0, Math.PI * 2);
    offCtx.fillStyle = `rgb(${fillGray},${fillGray},${fillGray})`;
    offCtx.fill();

    const imgData = offCtx.getImageData(0, 0, size, size);
    floydSteinbergDither(imgData);
    offCtx.putImageData(imgData, 0, 0);

    cached = { canvas: off, size };
    if (_circleCache.size > _CIRCLE_CACHE_MAX) {
      _circleCache.delete(_circleCache.keys().next().value!);
    }
    _circleCache.set(key, cached);
  }

  ctx.drawImage(cached.canvas, Math.round(cx - cached.size / 2), Math.round(cy - cached.size / 2));
}

// ── Draw Accent Ring (non-dithered, smooth glow) ─────────────────────────────
export function drawAccentRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  progress: number,
  skin: Skin
): void {
  if (progress <= 0) return;
  const accentColor = `#${skin.accent}`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── Scanlines ────────────────────────────────────────────────────────────────
export function applyScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, skin: Skin): void {
  ctx.fillStyle = `rgba(0, 0, 0, ${skin.scanlineOpacity})`;
  for (let y = 0; y < h; y += skin.scanlineGap) {
    ctx.fillRect(0, y, w, 1);
  }
}

// ── Vignette ─────────────────────────────────────────────────────────────────
export function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, skin: Skin): void {
  const cx = w / 2;
  const cy = h / 2;
  const outerRadius = Math.sqrt(cx * cx + cy * cy);
  const s = skin.vignetteStrength;
  const grad = ctx.createRadialGradient(cx, cy, outerRadius * 0.35, cx, cy, outerRadius);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.7, `rgba(0,0,0,${s * 0.25})`);
  grad.addColorStop(1, `rgba(0,0,0,${s})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── Stippled Line ────────────────────────────────────────────────────────────
export function drawStippledLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  gap: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.floor(dist / (gap || 4));
  ctx.fillStyle = color || "#fff";
  for (let i = 0; i < steps; i += 2) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + dx * t), Math.round(y0 + dy * t), 1, 1);
  }
}

// ── Draw Dithered Box ────────────────────────────────────────────────────────
export function drawDitheredBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillGray: number
): void {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d")!;
  offCtx.fillStyle = `rgb(${fillGray},${fillGray},${fillGray})`;
  offCtx.fillRect(0, 0, w, h);
  const imgData = offCtx.getImageData(0, 0, w, h);
  floydSteinbergDither(imgData);
  offCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(off, Math.round(x), Math.round(y));
}
