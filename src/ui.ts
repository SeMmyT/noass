// ── ui.ts — Stats Panel & Log ────────────────────────────────────────────────
// Top stats bar. Bottom scrolling log. All dithered. All monospace.

import type { AppState, LogEntry, Skin } from "./types";
import { drawDitheredText, drawDitheredBox, drawStippledLine } from "./renderer";

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatTime(ts: number): string {
  const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const EVENT_ICONS: Record<string, { icon: string; label: string }> = {
  new_pane: { icon: "\u25CF", label: "SPAWNED" },
  died:     { icon: "\u2715", label: "KILLED" },
  revived:  { icon: "\u2191", label: "REVIVED" },
  removed:  { icon: "\u25CB", label: "REMOVED" },
};

function getEventDisplay(entry: LogEntry): { icon: string; label: string } {
  const evt = entry.event || entry.action || "";
  return EVENT_ICONS[evt] || { icon: "\u00B7", label: evt.toUpperCase() };
}

// ── Draw Stats Bar (top) ─────────────────────────────────────────────────────
function drawStatsBar(app: AppState, skin: Skin): void {
  const ctx = app.ctx;
  const stats = app.state!.stats;
  const m = app.isMobile;
  const barH = m ? 28 : 40;
  const fs = m ? 10 : 13;
  const y = m ? 14 : 18;

  drawDitheredBox(ctx, 0, 0, app.width, barH, 15);

  let totalRate = 0;
  for (const p of app.state!.panes) {
    if (p.rate_k_per_min) totalRate += p.rate_k_per_min;
  }

  if (m) {
    const segments = [
      { text: `${stats.alive}A`, color: "accent" as const },
      { text: ` ${stats.dead}D`, color: "white" as const },
      { text: ` ${formatNum(stats.total_ctx_k)}k`, color: "accent" as const },
      { text: ` ${formatUptime(stats.uptime_sec)}`, color: "accent" as const },
      { text: ` ${totalRate.toFixed(1)}k/m`, color: "accent" as const },
    ];
    let x = 8;
    const charW = 6;
    for (const seg of segments) {
      drawDitheredText(ctx, seg.text, x, y, fs, { color: seg.color, bold: seg.color === "accent" }, skin);
      x += seg.text.length * charW;
    }
  } else {
    const segments = [
      { text: "\u25C9 ", color: "accent" as const },
      { text: `${stats.alive} ALIVE`, color: "accent" as const },
      { text: "  \u25CC ", color: "white" as const },
      { text: `${stats.dead} DEAD`, color: "white" as const },
      { text: "  \u2502  ", color: "white" as const },
      { text: "CTX: ", color: "white" as const },
      { text: `${formatNum(stats.total_ctx_k)}k`, color: "accent" as const },
      { text: "  \u2502  ", color: "white" as const },
      { text: "SESSION: ", color: "white" as const },
      { text: formatUptime(stats.uptime_sec), color: "accent" as const },
      { text: "  \u2502  ", color: "white" as const },
      { text: "RATE: ", color: "white" as const },
      { text: `${totalRate.toFixed(1)}k/min`, color: "accent" as const },
    ];
    let x = 15;
    const charW = 8;
    for (const seg of segments) {
      drawDitheredText(ctx, seg.text, x, y, fs, { color: seg.color, bold: seg.color === "accent" }, skin);
      x += seg.text.length * charW;
    }
    drawDitheredText(ctx, `${stats.total_panes} PANES`, app.width - 15, y, 11, { color: "white", align: "right" }, skin);
  }
}

// ── Draw Log Panel (bottom) ──────────────────────────────────────────────────
function drawLogPanel(app: AppState, skin: Skin): void {
  const ctx = app.ctx;
  const log = app.state!.log || [];
  const m = app.isMobile;
  const panelH = m ? 100 : 150;
  const panelY = app.height - panelH;
  const fs = m ? 8 : 10;
  const lineH = m ? 13 : 16;

  drawDitheredBox(ctx, 0, panelY, app.width, panelH, 10);
  drawStippledLine(
    ctx, 0, panelY, app.width, panelY,
    `rgba(${skin.accentRGB.r},${skin.accentRGB.g},${skin.accentRGB.b},0.3)`,
    3
  );
  drawDitheredText(ctx, "EVENT LOG", m ? 8 : 15, panelY + (m ? 11 : 14), m ? 8 : 10, { color: "accent", bold: true }, skin);

  const headerH = m ? 18 : 28;
  const maxLines = Math.floor((panelH - headerH) / lineH);
  const entries = log.slice(-maxLines);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = panelY + headerH + 2 + i * lineH;
    const ts = formatTime(entry.timestamp || entry.ts || 0);
    const display = getEventDisplay(entry);
    const name = entry.name || entry.target || "";

    if (m) {
      drawDitheredText(ctx, `[${ts.substring(0, 5)}]`, 8, y, fs, { color: "white" }, skin);
      drawDitheredText(ctx, `${display.icon} ${display.label}`, 58, y, fs, { color: "accent", bold: true }, skin);
      drawDitheredText(ctx, name, 130, y, fs, { color: "white" }, skin);
    } else {
      drawDitheredText(ctx, `[${ts}]`, 15, y, fs, { color: "white" }, skin);
      drawDitheredText(ctx, `${display.icon} ${display.label}`, 110, y, fs, { color: "accent", bold: true }, skin);
      drawDitheredText(ctx, name, 240, y, fs, { color: "white" }, skin);
      const detail = entry.detail || "";
      if (detail) {
        const detailTrunc = detail.length > 40 ? detail.substring(0, 37) + "..." : detail;
        drawDitheredText(ctx, detailTrunc, 370, y, fs, { color: "white" }, skin);
      }
    }
  }
}

export function drawUI(app: AppState): void {
  drawStatsBar(app, app.skin);
  drawLogPanel(app, app.skin);
}
