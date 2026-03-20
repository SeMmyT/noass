// ── settings.ts — DOM-based settings drawer ─────────────────────────────────
// Uses real DOM (not Canvas) for reliable keyboard/focus on mobile WebView.

import type { AppState, Skin } from "./types";
import { getBundledSkins } from "./skins";
import { clearTextCache, clearCircleCache } from "./renderer";
import { connectWS } from "./ws-client";
import { startMock, stopMock, isMockRunning } from "./mock";

// Safe DOM helpers
function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function textEl(tag: string, text: string, className?: string): HTMLElement {
  const e = el(tag, className);
  e.textContent = text;
  return e;
}

function toggleEl(id: string, label: string, checked: boolean): HTMLLabelElement {
  const lbl = document.createElement("label");
  lbl.className = "settings-toggle";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id = id;
  cb.checked = checked;
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(` ${label}`));
  return lbl;
}

let overlay: HTMLDivElement | null = null;
let visible = false;

export function isSettingsVisible(): boolean {
  return visible;
}

export function toggleSettings(app: AppState, onMessage: (msg: any) => void): void {
  if (visible) {
    hideSettings();
  } else {
    showSettings(app, onMessage);
  }
}

function applySkin(app: AppState, skin: Skin): void {
  app.skin = skin;
  clearTextCache();
  clearCircleCache();
}

function showSettings(app: AppState, onMessage: (msg: any) => void): void {
  if (overlay) overlay.remove();

  visible = true;
  overlay = document.createElement("div");
  overlay.id = "settings-overlay";

  const skins = getBundledSkins();

  // Build DOM safely — no innerHTML with dynamic values
  const panel = el("div", "settings-panel");
  const header = el("div", "settings-header");
  header.appendChild(textEl("span", "SETTINGS", "settings-title"));
  const closeBtn = textEl("span", "\u00d7", "settings-close");
  closeBtn.id = "settings-close";
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "settings-body");

  body.appendChild(textEl("label", "SERVER URL", "settings-label"));
  const wsInput = document.createElement("input");
  wsInput.type = "text";
  wsInput.id = "settings-ws-url";
  wsInput.className = "settings-input";
  wsInput.value = app.ws ? "connected" : "";
  wsInput.placeholder = "ws://192.168.1.x:3333";
  body.appendChild(wsInput);

  const connectBtn = textEl("button", "CONNECT", "settings-btn");
  connectBtn.id = "settings-connect";
  body.appendChild(connectBtn);

  const demoBtn = textEl("button", isMockRunning() ? "STOP DEMO" : "START DEMO", "settings-btn settings-btn-dim");
  demoBtn.id = "settings-demo";
  body.appendChild(demoBtn);

  const skinLabel = textEl("label", "SKIN", "settings-label");
  skinLabel.style.marginTop = "16px";
  body.appendChild(skinLabel);

  const skinGrid = el("div", "settings-skin-grid");
  skinGrid.id = "settings-skin-grid";
  for (const s of skins) {
    const card = el("div", `settings-skin-card${s.id === app.skin.id ? " active" : ""}`);
    card.dataset.skin = s.id;
    const swatch = el("div", "settings-skin-swatch");
    swatch.style.background = `#${s.accent}`;
    card.appendChild(swatch);
    card.appendChild(textEl("div", s.name, "settings-skin-name"));
    skinGrid.appendChild(card);
  }
  body.appendChild(skinGrid);

  const dispLabel = textEl("label", "DISPLAY", "settings-label");
  dispLabel.style.marginTop = "16px";
  body.appendChild(dispLabel);

  body.appendChild(toggleEl("settings-scanlines", "Scanlines", app.skin.scanlineOpacity > 0));
  body.appendChild(toggleEl("settings-vignette", "Vignette", app.skin.vignetteStrength > 0));

  const about = el("div", "settings-about");
  const accentSpan = textEl("span", "#0A55");
  accentSpan.style.color = `#${app.skin.accent}`;
  about.appendChild(accentSpan);
  about.appendChild(document.createTextNode(" v0.1.0"));
  about.appendChild(document.createElement("br"));
  about.appendChild(document.createTextNode("Not Only Agent Screen Saver"));
  about.appendChild(document.createElement("br"));
  const credit = textEl("span", "SeMmy + Claude Opus 4.6");
  credit.style.color = "#888";
  about.appendChild(credit);
  body.appendChild(about);

  panel.appendChild(body);
  overlay.appendChild(panel);

  document.body.appendChild(overlay);

  // Close
  document.getElementById("settings-close")!.addEventListener("click", hideSettings);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideSettings();
  });

  // Connect
  document.getElementById("settings-connect")!.addEventListener("click", () => {
    const input = document.getElementById("settings-ws-url") as HTMLInputElement;
    const url = input.value.trim();
    if (url && url.startsWith("ws")) {
      stopMock();
      if (app.ws) app.ws.close();
      connectWS(app, url, onMessage);
      hideSettings();
    }
  });

  // Demo toggle
  document.getElementById("settings-demo")!.addEventListener("click", () => {
    if (isMockRunning()) {
      stopMock();
      app.state = null;
    } else {
      if (app.ws) app.ws.close();
      startMock(app);
    }
    hideSettings();
  });

  // Skin selection
  document.getElementById("settings-skin-grid")!.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest("[data-skin]") as HTMLElement;
    if (!card) return;
    const skinId = card.dataset.skin;
    const skin = skins.find(s => s.id === skinId);
    if (skin) {
      applySkin(app, skin);
      // Update active state
      document.querySelectorAll(".settings-skin-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      // Update accent references in the panel
      const about = overlay!.querySelector(".settings-about span") as HTMLElement;
      if (about) about.style.color = `#${skin.accent}`;
    }
  });
}

function hideSettings(): void {
  visible = false;
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

// Inject settings CSS once
const style = document.createElement("style");
style.textContent = `
#settings-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.7);
  display: flex; justify-content: flex-end;
}
.settings-panel {
  width: 300px; max-width: 85vw; height: 100%;
  background: #12121a; border-left: 1px solid #2a2a3a;
  display: flex; flex-direction: column;
  font-family: 'Liberation Mono', monospace; font-size: 12px; color: #cdd6f4;
  animation: slideIn 0.2s ease-out;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.settings-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid #2a2a3a;
}
.settings-title { font-size: 11px; letter-spacing: 0.1em; color: #ffa000; }
.settings-close { font-size: 22px; cursor: pointer; color: #888; }
.settings-close:hover { color: #fff; }
.settings-body { padding: 16px; overflow-y: auto; flex: 1; }
.settings-label { display: block; font-size: 10px; letter-spacing: 0.1em; color: #6c7086; margin-bottom: 6px; }
.settings-input {
  width: 100%; padding: 8px 10px; background: #0a0a0f; border: 1px solid #2a2a3a;
  color: #cdd6f4; font-family: inherit; font-size: 12px; border-radius: 3px;
  margin-bottom: 8px;
}
.settings-input:focus { border-color: #ffa000; outline: none; }
.settings-btn {
  width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #2a2a3a;
  color: #ffa000; font-family: inherit; font-size: 11px; cursor: pointer;
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
}
.settings-btn:hover { background: #252540; border-color: #ffa000; }
.settings-btn-dim { color: #6c7086; }
.settings-btn-dim:hover { color: #cdd6f4; }
.settings-skin-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px;
}
.settings-skin-card {
  background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 4px;
  padding: 8px; cursor: pointer; text-align: center;
}
.settings-skin-card:hover { border-color: #555; }
.settings-skin-card.active { border-color: #ffa000; }
.settings-skin-swatch {
  width: 100%; height: 24px; border-radius: 2px; margin-bottom: 4px;
}
.settings-skin-name { font-size: 9px; color: #888; }
.settings-toggle {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: #888; margin-bottom: 6px; cursor: pointer;
}
.settings-toggle input { accent-color: #ffa000; }
.settings-about {
  margin-top: 24px; padding-top: 16px; border-top: 1px solid #2a2a3a;
  font-size: 10px; color: #555; line-height: 1.6;
}
`;
document.head.appendChild(style);
