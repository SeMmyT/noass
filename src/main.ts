// ── main.ts — App init, render loop, Wake Lock ──────────────────────────────

import type { AppState, ServerMessage } from "./types";
import { drawDitheredText, applyScanlines, applyVignette, clearTextCache, clearCircleCache } from "./renderer";
import { drawGraph, updateGraph } from "./graph";
import { drawUI } from "./ui";
import { initControls, drawControls, showReadOverlay } from "./controls";
import { connectWS } from "./ws-client";
import { DEFAULT_SKIN, getBundledSkins } from "./skins";

function createAppState(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): AppState {
  // Check URL params for skin override
  const params = new URLSearchParams(location.search);
  const skinId = params.get("skin");
  let skin = DEFAULT_SKIN;
  if (skinId) {
    const found = getBundledSkins().find((s) => s.id === skinId);
    if (found) skin = found;
  }

  return {
    ws: null,
    state: null,
    prevState: null,
    skin,
    nodes: [],
    selectedNode: null,
    showContextMenu: false,
    contextMenuPos: { x: 0, y: 0 },
    paused: false,
    time: 0,
    lastDataTime: 0,
    width: 0,
    height: 0,
    isMobile: false,
    dpr: 1,
    canvas,
    ctx,
    _mouseX: 0,
    _mouseY: 0,
  };
}

function resize(app: AppState): void {
  const dpr = window.devicePixelRatio || 1;
  app.dpr = dpr;
  app.width = window.innerWidth;
  app.height = window.innerHeight;
  app.canvas.width = app.width * dpr;
  app.canvas.height = app.height * dpr;
  app.canvas.style.width = app.width + "px";
  app.canvas.style.height = app.height + "px";
  app.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  app.isMobile = app.width < 600;
  clearTextCache();
  clearCircleCache();
}

function animate(app: AppState): void {
  if (!app.paused) {
    app.time = performance.now();

    app.ctx.fillStyle = `#${app.skin.bgColor}`;
    app.ctx.fillRect(0, 0, app.width, app.height);

    if (app.state) {
      drawGraph(app);
      drawUI(app);
      drawControls(app);
    } else {
      drawDitheredText(
        app.ctx,
        "WAITING FOR SIGNAL...",
        app.width / 2,
        app.height / 2,
        24,
        { color: "accent", align: "center" },
        app.skin
      );
    }

    applyVignette(app.ctx, app.width, app.height, app.skin);
    applyScanlines(app.ctx, app.width, app.height, app.skin);
  }

  requestAnimationFrame(() => animate(app));
}

async function requestWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      await navigator.wakeLock.request("screen");
    }
  } catch {
    // Wake Lock not available or denied — non-fatal
  }
}

function handleMessage(app: AppState, msg: ServerMessage): void {
  switch (msg.type) {
    case "state":
      app.prevState = app.state;
      app.state = msg;
      app.lastDataTime = performance.now();
      updateGraph(app);
      break;
    case "readResult":
      showReadOverlay(msg.target, msg.content, app.skin);
      break;
    case "ack":
      // Silent for now
      break;
  }
}

function init(): void {
  const canvas = document.getElementById("main") as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const app = createAppState(canvas, ctx);

  resize(app);
  window.addEventListener("resize", () => resize(app));

  initControls(app);

  // WS URL from URL params or default
  const params = new URLSearchParams(location.search);
  const wsUrl = params.get("ws") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  connectWS(app, wsUrl, (msg) => handleMessage(app, msg));

  requestWakeLock();
  animate(app);
}

window.addEventListener("DOMContentLoaded", init);
