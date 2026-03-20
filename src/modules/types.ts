// ── modules/types.ts — EEOAO module interface ─────────────────────────────────

import type { Skin, StateMessage } from "../types";

export interface ModuleContext {
  readonly skin: Skin;
  readonly state: StateMessage | null;
  readonly width: number;
  readonly height: number;
  readonly isMobile: boolean;
  onDestroy(fn: () => void): void;
}

export interface NOASSModule {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly hidden: boolean;
  unlockCondition?: string;

  init(ctx: ModuleContext): void;
  render(canvasCtx: CanvasRenderingContext2D, moduleCtx: ModuleContext): void;
  handleInput(type: string, x: number, y: number, moduleCtx: ModuleContext): boolean;
  destroy(): void;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: (stats: AchievementStats) => boolean;
  unlockedAt?: number;
}

export interface AchievementStats {
  agentsKilled: number;
  skinsApplied: number;
  totalContextSeen: number;
  nightSessions: number; // sessions started after midnight
  sessionCount: number;
}
