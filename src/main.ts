// ── main.ts — App init, render loop, Wake Lock ──────────────────────────────

import type { AppState, ServerMessage } from "./types";
import { drawDitheredText, applyScanlines, applyVignette, clearTextCache, clearCircleCache } from "./renderer";
import { drawGraph, updateGraph } from "./graph";
import { drawUI } from "./ui";
import { initControls, drawControls, showReadOverlay } from "./controls";
import { connectWS, getConnectionStatus } from "./ws-client";
import { DEFAULT_SKIN, getBundledSkins } from "./skins";
import { startMock, isMockRunning } from "./mock";
import { toggleSettings, isSettingsVisible } from "./settings";
import { currentScreen, pushScreen, popScreen } from "./screens";
import { drawMarketplace, handleMarketplaceTap, handleMarketplaceScroll, resetMarketplace } from "./marketplace";
import { updateWeather, drawWeather, setWeather } from "./weather";
import { requestMotionPermission } from "./physics-device";
import { registerModule, checkAchievements, trackEvent, getActiveModule, activateModule, deactivateModule, createModuleContext, drawModuleGrid, hitTestModuleGrid } from "./modules/registry";
import { PLACEHOLDER_MODULES } from "./modules/placeholders";

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

let frameCount = 0;
let lastFpsTime = 0;
let fps = 0;
const showFps = new URLSearchParams(location.search).get("fps") === "1";

function animate(app: AppState): void {
  if (!app.paused) {
    app.time = performance.now();

    // FPS counter
    frameCount++;
    if (app.time - lastFpsTime > 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = app.time;
    }

    const screen = currentScreen();

    if (screen === "marketplace") {
      drawMarketplace(app);
    } else if (screen.startsWith("module:")) {
      // ── Active module render ──────────────────────────────────────────
      const mod = getActiveModule();
      if (mod) {
        mod.render(app.ctx, createModuleContext(app));
      }
      // Back hint
      drawDitheredText(app.ctx, "[ESC] BACK", 15, app.height - 15, 9, { color: "white" }, app.skin);
    } else {
      // Dashboard
      app.ctx.fillStyle = `#${app.skin.bgColor}`;
      app.ctx.fillRect(0, 0, app.width, app.height);

      if (app.state) {
        drawGraph(app);
        drawUI(app);
        drawModuleGrid(app.ctx, app);
        drawControls(app);

        // DEMO badge
        if (isMockRunning()) {
          drawDitheredText(app.ctx, "DEMO", app.width - 40, app.isMobile ? 14 : 18, app.isMobile ? 9 : 11, { color: "accent", align: "right", bold: true }, app.skin);
        }

        // Gear + Marketplace icons (top-right)
        if (!isSettingsVisible()) {
          drawDitheredText(app.ctx, "[M] [S]", app.width - 15, app.isMobile ? 14 : 18, app.isMobile ? 9 : 11, { color: "white", align: "right" }, app.skin);
        }
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
    }

    // Weather particles (before post-processing)
    updateWeather(app);
    drawWeather(app.ctx, app.skin);

    applyVignette(app.ctx, app.width, app.height, app.skin);
    applyScanlines(app.ctx, app.width, app.height, app.skin);

    // Connection status dot (bottom-left)
    if (!isMockRunning()) {
      const cs = getConnectionStatus();
      const dotColor = cs === "connected" ? "#00ff41" : cs === "reconnecting" ? "#ffb000" : "#ff2222";
      app.ctx.beginPath();
      app.ctx.arc(12, app.height - 12, 4, 0, Math.PI * 2);
      app.ctx.fillStyle = dotColor;
      app.ctx.fill();
    }

    // FPS counter (debug mode)
    if (showFps) {
      app.ctx.fillStyle = "#888";
      app.ctx.font = "10px monospace";
      app.ctx.fillText(`${fps} fps`, 5, 12);
    }
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
      trackEvent("context_update", msg.stats.total_ctx_k);
      checkAchievements();
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
  const onMessage = (msg: ServerMessage) => handleMessage(app, msg);

  resize(app);
  window.addEventListener("resize", () => resize(app));

  initControls(app);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
    const key = e.key.toUpperCase();

    if (key === "S" && !e.ctrlKey && !e.metaKey) {
      toggleSettings(app, onMessage);
    } else if (key === "M" && !e.ctrlKey && !e.metaKey) {
      if (currentScreen() === "marketplace") {
        popScreen();
      } else {
        resetMarketplace();
        pushScreen("marketplace");
      }
    } else if (key === "ESCAPE" || key === "BACKSPACE") {
      const cur = currentScreen();
      if (cur.startsWith("module:")) {
        deactivateModule();
        popScreen();
      } else if (cur !== "dashboard") {
        popScreen();
      }
    }
  });

  // Marketplace + module grid tap handler
  app.canvas.addEventListener("click", (e) => {
    const screen = currentScreen();
    if (screen === "marketplace") {
      const stay = handleMarketplaceTap(app, e.clientX, e.clientY);
      if (!stay) popScreen();
    } else if (screen === "dashboard") {
      const modId = hitTestModuleGrid(app, e.clientX, e.clientY);
      if (modId) {
        activateModule(modId, app);
        pushScreen(`module:${modId}`);
      }
    }
  });

  // Touch scroll for marketplace
  let touchStartY = 0;
  app.canvas.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
  });
  app.canvas.addEventListener("touchmove", (e) => {
    if (currentScreen() === "marketplace") {
      const dy = touchStartY - e.touches[0].clientY;
      handleMarketplaceScroll(dy);
      touchStartY = e.touches[0].clientY;
    }
  });

  // Demo mode or WebSocket
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") {
    startMock(app);
  } else {
    const wsUrl = params.get("ws") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
    connectWS(app, wsUrl, onMessage);
    // Fall back to mock after 5s if no data received
    setTimeout(() => {
      if (!app.state && !isMockRunning()) {
        startMock(app);
      }
    }, 5000);
  }

  // Weather from URL param
  const weatherParam = params.get("weather");
  if (weatherParam) {
    setWeather(weatherParam as any);
  }

  // Register EEOAO modules
  for (const mod of PLACEHOLDER_MODULES) {
    registerModule(mod);
  }

  // Request motion permission on first user interaction
  document.addEventListener("click", () => requestMotionPermission(), { once: true });

  requestWakeLock();
  animate(app);
}

window.addEventListener("DOMContentLoaded", init);
