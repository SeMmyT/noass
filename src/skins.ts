// ── skins.ts — Bundled skin definitions ──────────────────────────────────────

import type { Skin } from "./types";
import { hexToRGB } from "./renderer";

export const DEFAULT_SKIN: Skin = {
  id: "matrix",
  name: "Matrix",
  author: "NOASS",
  version: "1.0.0",
  description: "Classic green phosphor terminal. The original.",
  accent: "00ff41",
  accentRGB: hexToRGB("00ff41"),
  nodeAliveGray: 120,
  nodeDeadGray: 40,
  bgColor: "000000",
  scanlineOpacity: 0.15,
  scanlineGap: 3,
  vignetteStrength: 0.6,
  crtCurvature: false,
  pulseHz: 0.5,
  pulseAmp: 3,
  fontFamily: "IBM Plex Mono",
  connectionStyle: "stippled",
  connectionGap: 5,
};

export function loadSkin(json: Partial<Skin> & { id: string }): Skin {
  return {
    ...DEFAULT_SKIN,
    ...json,
    accentRGB: hexToRGB(json.accent || DEFAULT_SKIN.accent),
  };
}

export function getBundledSkins(): Skin[] {
  return [
    DEFAULT_SKIN,
    loadSkin({
      id: "amber", name: "Amber CRT", author: "NOASS", version: "1.0.0",
      description: "Warm amber phosphor. 1983 IBM.",
      accent: "ffb000", nodeAliveGray: 130, nodeDeadGray: 35,
      scanlineOpacity: 0.2, scanlineGap: 2, vignetteStrength: 0.7, crtCurvature: true,
    }),
    loadSkin({
      id: "ice", name: "Ice", author: "NOASS", version: "1.0.0",
      description: "Cold blue terminal. Server room at 3AM.",
      accent: "00d4ff", nodeAliveGray: 110, nodeDeadGray: 30,
      scanlineOpacity: 0.1, scanlineGap: 3, vignetteStrength: 0.5,
    }),
    loadSkin({
      id: "blood", name: "Blood Moon", author: "NOASS", version: "1.0.0",
      description: "Red alert. Something is on fire.",
      accent: "ff2222", nodeAliveGray: 100, nodeDeadGray: 25,
      scanlineOpacity: 0.18, scanlineGap: 3, vignetteStrength: 0.65,
      pulseHz: 0.8, pulseAmp: 4,
    }),
    loadSkin({
      id: "phantom", name: "Phantom", author: "NOASS", version: "1.0.0",
      description: "Pale violet. Ghost in the machine.",
      accent: "bb86fc", nodeAliveGray: 115, nodeDeadGray: 35,
      scanlineOpacity: 0.12, scanlineGap: 3, vignetteStrength: 0.55,
      connectionStyle: "dashed",
    }),
    loadSkin({
      id: "solar", name: "Solar Flare", author: "NOASS", version: "1.0.0",
      description: "Orange nova. High energy.",
      accent: "ff6600", nodeAliveGray: 135, nodeDeadGray: 40,
      scanlineOpacity: 0.15, scanlineGap: 3, vignetteStrength: 0.5,
      pulseHz: 0.7, pulseAmp: 3.5,
    }),
  ];
}
