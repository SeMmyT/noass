// ── weather.ts — Particle weather effects overlaid on canvas ──────────────────

import type { AppState, Skin } from "./types";
import { getDevicePhysics } from "./physics-device";

export type WeatherType = "none" | "rain" | "snow" | "static" | "matrix" | "sparks";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  char?: string; // for matrix mode
}

const MAX_PARTICLES = 200;
const MATRIX_CHARS = "01#$%&@ABCDEFノアウエオカキクケコサシスセソタチツテト";

let particles: Particle[] = [];
let weatherType: WeatherType = "none";

export function setWeather(type: WeatherType): void {
  if (type !== weatherType) {
    weatherType = type;
    particles = [];
  }
}

export function getWeather(): WeatherType {
  return weatherType;
}

function spawnParticle(w: number, h: number, _skin: Skin): Particle {
  switch (weatherType) {
    case "rain":
      return {
        x: Math.random() * w,
        y: -10,
        vx: 0,
        vy: 4 + Math.random() * 6,
        life: 0,
        maxLife: h / 4,
        size: 1,
      };

    case "snow":
      return {
        x: Math.random() * w,
        y: -5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 1.5,
        life: 0,
        maxLife: h / 1.5,
        size: Math.random() > 0.7 ? 2 : 1,
      };

    case "static":
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 2 + Math.random() * 3,
        size: 1,
      };

    case "matrix":
      return {
        x: Math.floor(Math.random() * (w / 10)) * 10,
        y: -10,
        vx: 0,
        vy: 2 + Math.random() * 4,
        life: 0,
        maxLife: h / 3,
        size: 10,
        char: MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
      };

    case "sparks":
      return {
        x: w * 0.3 + Math.random() * w * 0.4,
        y: h * 0.5 + Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 2,
        vy: -(1 + Math.random() * 3),
        life: 0,
        maxLife: 30 + Math.random() * 40,
        size: 1,
      };

    default:
      return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1 };
  }
}

export function updateWeather(app: AppState): void {
  if (weatherType === "none") return;

  const { width, height, skin } = app;
  const dp = getDevicePhysics();

  // Spawn new particles
  const density = 0.5; // could come from skin later
  const spawnRate = weatherType === "static" ? 20 : weatherType === "sparks" ? 3 : 5;
  for (let i = 0; i < spawnRate && particles.length < MAX_PARTICLES * density; i++) {
    particles.push(spawnParticle(width, height, skin));
  }

  // Update particles
  for (const p of particles) {
    p.life++;

    // Device gravity influence (rain/snow/sparks react to tilt)
    if (weatherType === "rain" || weatherType === "snow" || weatherType === "sparks") {
      p.vx += dp.gravityX * 0.3;
      p.vy += dp.gravityY * 0.1;
    }

    // Shake gust
    if (dp.shaking) {
      p.vx += (Math.random() - 0.5) * 10;
      p.vy += (Math.random() - 0.5) * 5;
    }

    p.x += p.vx;
    p.y += p.vy;

    // Damping for sparks
    if (weatherType === "sparks") {
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
  }

  // Remove dead particles
  particles = particles.filter(
    (p) => p.life < p.maxLife && p.x >= -20 && p.x <= width + 20 && p.y >= -20 && p.y <= height + 20
  );
}

export function drawWeather(ctx: CanvasRenderingContext2D, skin: Skin): void {
  if (weatherType === "none" || particles.length === 0) return;

  const { r, g, b } = skin.accentRGB;

  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.life / p.maxLife);

    switch (weatherType) {
      case "rain":
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.4})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 3 + Math.random() * 2);
        break;

      case "snow":
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        break;

      case "static":
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        break;

      case "matrix":
        if (p.char) {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.6})`;
          ctx.font = "10px monospace";
          ctx.fillText(p.char, Math.round(p.x), Math.round(p.y));
        }
        break;

      case "sparks":
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.8})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        break;
    }
  }
}
