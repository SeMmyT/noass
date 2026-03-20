// ── mock.ts — Client-side mock data for demo/screenshots ──────────────────────

import type { AppState, StateMessage, PaneData, LogEntry } from "./types";
import { updateGraph } from "./graph";

const MOCK_NAMES = [
  "arc-ui", "bridge-api", "ghost-cli", "dither-engine",
  "koan-db", "prefab-sync", "skin-renderer",
];

const MOCK_LASTS = [
  "writing tests...",
  "refactoring module...",
  "reading config...",
  "deploying build...",
  "waiting for input...",
  "analyzing logs...",
  "idle",
];

let mockPanes: PaneData[] = [];
let mockLog: LogEntry[] = [];
let mockStartTime = 0;
let tickCount = 0;

export function initMock(): void {
  mockStartTime = Date.now();
  tickCount = 0;
  mockLog = [];
  mockPanes = MOCK_NAMES.map((name, i) => ({
    idx: i + 1,
    name,
    alive: Math.random() > 0.3,
    ctx_k: Math.round((100 + Math.random() * 500) * 10) / 10,
    last: MOCK_LASTS[i % MOCK_LASTS.length],
    rate_k_per_min: Math.round(Math.random() * 20 * 100) / 100,
    eta_800k_min: null,
    ctx_pct: 0,
  }));

  // Calculate derived fields
  for (const p of mockPanes) {
    p.ctx_pct = Math.round((p.ctx_k / 800) * 1000) / 10;
    if (p.alive && p.rate_k_per_min > 0) {
      p.eta_800k_min = Math.round(((800 - p.ctx_k) / p.rate_k_per_min) * 10) / 10;
    }
  }

  // Seed a few log entries
  for (let i = 0; i < 5; i++) {
    mockLog.push({
      event: "new_pane",
      name: MOCK_NAMES[i],
      timestamp: mockStartTime - (5 - i) * 10000,
    });
  }
}

export function tickMock(app: AppState): void {
  tickCount++;

  for (const p of mockPanes) {
    // Drift context upward
    const drift = Math.random() * 2.5;
    p.ctx_k = Math.round((p.ctx_k + drift) * 10) / 10;
    if (p.ctx_k > 800) p.ctx_k = 100 + Math.random() * 50;

    // Occasional state flip (~5%)
    if (Math.random() < 0.05) {
      const wasAlive = p.alive;
      p.alive = !p.alive;
      mockLog.push({
        event: wasAlive ? "died" : "revived",
        name: p.name,
        timestamp: Date.now(),
      });
      if (mockLog.length > 50) mockLog.shift();
    }

    // Update rate
    p.rate_k_per_min = Math.round((Math.random() * 15 + 5) * 100) / 100;
    p.ctx_pct = Math.round((p.ctx_k / 800) * 1000) / 10;
    p.eta_800k_min = p.alive && p.rate_k_per_min > 0
      ? Math.round(((800 - p.ctx_k) / p.rate_k_per_min) * 10) / 10
      : null;

    // Rotate "last" text occasionally
    if (Math.random() < 0.1) {
      p.last = MOCK_LASTS[Math.floor(Math.random() * MOCK_LASTS.length)];
    }
  }

  const alive = mockPanes.filter((p) => p.alive).length;
  const total_ctx_k = Math.round(mockPanes.reduce((s, p) => s + p.ctx_k, 0) * 10) / 10;

  const msg: StateMessage = {
    type: "state",
    panes: mockPanes,
    log: mockLog.slice(-30),
    stats: {
      total_panes: mockPanes.length,
      alive,
      dead: mockPanes.length - alive,
      total_ctx_k,
      uptime_sec: Math.round((Date.now() - mockStartTime) / 1000),
    },
  };

  app.prevState = app.state;
  app.state = msg;
  app.lastDataTime = performance.now();
  updateGraph(app);
}

let mockInterval: number | null = null;

export function startMock(app: AppState): void {
  initMock();
  tickMock(app); // Immediate first tick
  mockInterval = window.setInterval(() => tickMock(app), 2000);
}

export function stopMock(): void {
  if (mockInterval !== null) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

export function isMockRunning(): boolean {
  return mockInterval !== null;
}
