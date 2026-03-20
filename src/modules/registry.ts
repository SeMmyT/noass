// ── modules/registry.ts — Module registration and lifecycle ────────────────────

import type { NOASSModule, ModuleContext, Achievement, AchievementStats } from "./types";
import type { AppState } from "../types";
import { drawDitheredText, drawDitheredBox } from "../renderer";

// ── Registry ──────────────────────────────────────────────────────────────────
const modules = new Map<string, NOASSModule>();
const MODULE_ID_RE = /^[a-z][a-z0-9-]{1,30}$/;
const RESERVED = new Set(["dashboard", "settings", "marketplace", "read-overlay"]);

export function registerModule(mod: NOASSModule): void {
  if (!MODULE_ID_RE.test(mod.id)) {
    throw new Error(`Invalid module ID: "${mod.id}" — must match ${MODULE_ID_RE}`);
  }
  if (RESERVED.has(mod.id)) {
    throw new Error(`Module ID "${mod.id}" is reserved`);
  }
  if (modules.has(mod.id)) {
    throw new Error(`Module "${mod.id}" already registered`);
  }
  modules.set(mod.id, mod);
}

export function getModule(id: string): NOASSModule | undefined {
  return modules.get(id);
}

export function listModules(includeHidden = false): NOASSModule[] {
  return Array.from(modules.values()).filter((m) => includeHidden || !m.hidden);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let activeModule: NOASSModule | null = null;
let destroyCallbacks: (() => void)[] = [];

export function createModuleContext(app: AppState): ModuleContext {
  return {
    get skin() { return app.skin; },
    get state() { return app.state; },
    get width() { return app.width; },
    get height() { return app.height; },
    get isMobile() { return app.isMobile; },
    onDestroy(fn: () => void) {
      destroyCallbacks.push(fn);
    },
  };
}

export function activateModule(id: string, app: AppState): boolean {
  const mod = modules.get(id);
  if (!mod) return false;

  // Destroy previous
  if (activeModule) {
    activeModule.destroy();
    for (const fn of destroyCallbacks) fn();
    destroyCallbacks = [];
  }

  activeModule = mod;
  mod.init(createModuleContext(app));
  return true;
}

export function deactivateModule(): void {
  if (activeModule) {
    activeModule.destroy();
    for (const fn of destroyCallbacks) fn();
    destroyCallbacks = [];
    activeModule = null;
  }
}

export function getActiveModule(): NOASSModule | null {
  return activeModule;
}

// ── Achievements ──────────────────────────────────────────────────────────────
const stats: AchievementStats = {
  agentsKilled: 0,
  skinsApplied: 0,
  totalContextSeen: 0,
  nightSessions: new Date().getHours() < 6 || new Date().getHours() >= 23 ? 1 : 0,
  sessionCount: 1,
};

const achievements: Achievement[] = [
  {
    id: "first-blood",
    name: "First Blood",
    description: "Kill an agent from the dashboard",
    condition: (s) => s.agentsKilled >= 1,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Use the app after midnight",
    condition: (s) => s.nightSessions >= 1,
  },
  {
    id: "context-lord",
    name: "Context Lord",
    description: "Monitor 1M+ total context",
    condition: (s) => s.totalContextSeen >= 1000,
  },
  {
    id: "skin-collector",
    name: "Skin Collector",
    description: "Apply 3 different skins",
    condition: (s) => s.skinsApplied >= 3,
  },
];

export function trackEvent(event: "kill" | "skin_applied" | "context_update", value?: number): void {
  switch (event) {
    case "kill":
      stats.agentsKilled++;
      break;
    case "skin_applied":
      stats.skinsApplied++;
      break;
    case "context_update":
      if (value) stats.totalContextSeen = Math.max(stats.totalContextSeen, value);
      break;
  }
}

export function checkAchievements(): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  for (const a of achievements) {
    if (!a.unlockedAt && a.condition(stats)) {
      a.unlockedAt = Date.now();
      newlyUnlocked.push(a);
    }
  }
  return newlyUnlocked;
}

export function getAchievements(): Achievement[] {
  return achievements;
}

// ── Module drawer (Canvas) ────────────────────────────────────────────────────
export function drawModuleGrid(ctx: CanvasRenderingContext2D, app: AppState): void {
  const mods = listModules(false);
  if (mods.length === 0) return;

  const x = 15;
  const y = app.isMobile ? 50 : 60;
  const cardW = app.isMobile ? 60 : 80;
  const cardH = app.isMobile ? 50 : 60;
  const gap = 10;

  drawDitheredText(ctx, "MODULES", x, y - 8, app.isMobile ? 9 : 11,
    { color: "accent", bold: true }, app.skin);

  for (let i = 0; i < mods.length; i++) {
    const m = mods[i];
    const cx = x + i * (cardW + gap);
    drawDitheredBox(ctx, cx, y, cardW, cardH, 20);
    drawDitheredText(ctx, m.icon, cx + cardW / 2, y + (app.isMobile ? 18 : 22),
      app.isMobile ? 16 : 20, { color: "accent", align: "center" }, app.skin);
    drawDitheredText(ctx, m.name, cx + cardW / 2, y + (app.isMobile ? 35 : 42),
      app.isMobile ? 7 : 8, { color: "white", align: "center" }, app.skin);
  }
}
