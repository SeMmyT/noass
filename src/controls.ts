// ── controls.ts — Interactive Control Surface ────────────────────────────────
// Click nodes. Context menu. Keyboard shortcuts. WebSocket commands.

import type { AppState, GraphNode, Skin } from "./types";
import { drawDitheredText, drawDitheredBox } from "./renderer";
import { sendCommand } from "./ws-client";

// ── Read overlay ─────────────────────────────────────────────────────────────
export function showReadOverlay(target: string, content: string, skin: Skin): void {
  const overlay = document.getElementById("read-overlay");
  const pre = document.getElementById("read-content");
  if (!overlay || !pre) return;
  pre.textContent = `\u2500\u2500 ${target} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n${content}`;
  overlay.style.display = "block";
  overlay.style.borderColor = `#${skin.accent}`;
}

function closeReadOverlay(): void {
  const overlay = document.getElementById("read-overlay");
  if (overlay) overlay.style.display = "none";
}

// ── Hit test: find node under point ──────────────────────────────────────────
function hitTestNode(app: AppState, mx: number, my: number): GraphNode | null {
  for (let i = app.nodes.length - 1; i >= 0; i--) {
    const n = app.nodes[i];
    const dx = mx - n.x;
    const dy = my - n.y;
    if (dx * dx + dy * dy < (n.radius + 5) * (n.radius + 5)) {
      return n;
    }
  }
  return null;
}

// ── Context menu geometry ────────────────────────────────────────────────────
interface MenuItem {
  key: string;
  label: string;
  action: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: "R", label: "READ",   action: "read" },
  { key: "N", label: "NUDGE",  action: "nudge" },
  { key: "K", label: "KILL",   action: "kill" },
  { key: "V", label: "REVIVE", action: "revive" },
];
const MENU_W = 140;
const MENU_ITEM_H = 24;
const MENU_H = MENU_ITEMS.length * MENU_ITEM_H + 16;
const MENU_PAD = 8;

function getMenuRect(app: AppState): { x: number; y: number; w: number; h: number } {
  let x = app.contextMenuPos.x;
  let y = app.contextMenuPos.y;
  if (x + MENU_W > app.width - 10) x = app.width - MENU_W - 10;
  if (y + MENU_H > app.height - 10) y = app.height - MENU_H - 10;
  return { x, y, w: MENU_W, h: MENU_H };
}

function hitTestMenu(app: AppState, mx: number, my: number): number {
  if (!app.showContextMenu) return -1;
  const rect = getMenuRect(app);
  if (mx < rect.x || mx > rect.x + rect.w || my < rect.y || my > rect.y + rect.h) return -1;
  const localY = my - rect.y - MENU_PAD;
  const idx = Math.floor(localY / MENU_ITEM_H);
  if (idx >= 0 && idx < MENU_ITEMS.length) return idx;
  return -1;
}

// ── Execute menu action ──────────────────────────────────────────────────────
function executeAction(app: AppState, action: string): void {
  if (!app.selectedNode) return;
  const target = app.selectedNode.pane.name;

  switch (action) {
    case "read":
      sendCommand(app, "read", target, { lines: 50 });
      break;
    case "nudge": {
      const msg = prompt(`Nudge ${target} with message:`);
      if (msg) sendCommand(app, "nudge", target, { message: msg });
      break;
    }
    case "kill":
      sendCommand(app, "kill", target);
      break;
    case "revive":
      sendCommand(app, "revive", target);
      break;
  }

  app.showContextMenu = false;
}

// ── Init controls: event listeners ───────────────────────────────────────────
export function initControls(app: AppState): void {
  function handleTap(mx: number, my: number): void {
    if (app.showContextMenu) {
      const idx = hitTestMenu(app, mx, my);
      if (idx >= 0) {
        executeAction(app, MENU_ITEMS[idx].action);
        return;
      }
    }

    const node = hitTestNode(app, mx, my);
    if (node) {
      app.selectedNode = node;
      app.showContextMenu = true;
      app.contextMenuPos = {
        x: node.x + node.radius + 15,
        y: node.y - MENU_H / 2,
      };
    } else {
      app.selectedNode = null;
      app.showContextMenu = false;
    }
  }

  app.canvas.addEventListener("click", (e: MouseEvent) => handleTap(e.clientX, e.clientY));

  app.canvas.addEventListener("mousemove", (e: MouseEvent) => {
    app._mouseX = e.clientX;
    app._mouseY = e.clientY;
  });

  app.canvas.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      handleTap(t.clientX, t.clientY);
    },
    { passive: false }
  );

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    const key = e.key.toUpperCase();

    if (document.activeElement && (document.activeElement as HTMLElement).tagName === "INPUT") return;

    switch (key) {
      case "ESCAPE":
        app.selectedNode = null;
        app.showContextMenu = false;
        closeReadOverlay();
        break;
      case "R":
        if (app.selectedNode) executeAction(app, "read");
        break;
      case "N":
        if (app.selectedNode) executeAction(app, "nudge");
        break;
      case "K":
        if (app.selectedNode) executeAction(app, "kill");
        break;
      case "V":
        if (app.selectedNode) executeAction(app, "revive");
        break;
      case "F":
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        break;
      case " ":
        e.preventDefault();
        app.paused = !app.paused;
        break;
    }
  });
}

// ── Draw context menu ────────────────────────────────────────────────────────
export function drawControls(app: AppState): void {
  if (!app.showContextMenu || !app.selectedNode) return;

  const ctx = app.ctx;
  const skin = app.skin;
  const rect = getMenuRect(app);
  const mx = app._mouseX || 0;
  const my = app._mouseY || 0;
  const accentColor = `#${skin.accent}`;

  drawDitheredBox(ctx, rect.x, rect.y, rect.w, rect.h, 20);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 4;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.shadowBlur = 0;

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const itemY = rect.y + MENU_PAD + i * MENU_ITEM_H;
    const itemBottom = itemY + MENU_ITEM_H;

    const hovered = mx >= rect.x && mx <= rect.x + rect.w && my >= itemY && my < itemBottom;
    if (hovered) {
      ctx.fillStyle = `rgba(${skin.accentRGB.r},${skin.accentRGB.g},${skin.accentRGB.b},0.1)`;
      ctx.fillRect(rect.x + 1, itemY, rect.w - 2, MENU_ITEM_H);
    }

    drawDitheredText(ctx, `[${item.key}]`, rect.x + 12, itemY + 16, 11, { color: "accent", bold: true }, skin);
    drawDitheredText(ctx, item.label, rect.x + 50, itemY + 16, 11, { color: hovered ? "accent" : "white" }, skin);
  }
}
