// ── settings.ts — DOM-based settings drawer ─────────────────────────────────
// Uses real DOM (not Canvas) for reliable keyboard/focus on mobile WebView.

import type { AppState, Skin } from "./types";
import { getBundledSkins } from "./skins";
import { clearTextCache, clearCircleCache } from "./renderer";
import { connectWS } from "./ws-client";
import { startMock, stopMock, isMockRunning } from "./mock";

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

  overlay.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <span class="settings-title">SETTINGS</span>
        <span class="settings-close" id="settings-close">&times;</span>
      </div>
      <div class="settings-body">
        <label class="settings-label">SERVER URL</label>
        <input type="text" id="settings-ws-url" class="settings-input"
          value="${app.ws ? 'connected' : ''}"
          placeholder="ws://192.168.1.x:3333" />
        <button id="settings-connect" class="settings-btn">CONNECT</button>
        <button id="settings-demo" class="settings-btn settings-btn-dim">${isMockRunning() ? 'STOP DEMO' : 'START DEMO'}</button>

        <label class="settings-label" style="margin-top:16px">SKIN</label>
        <div class="settings-skin-grid" id="settings-skin-grid">
          ${skins.map(s => `
            <div class="settings-skin-card ${s.id === app.skin.id ? 'active' : ''}" data-skin="${s.id}">
              <div class="settings-skin-swatch" style="background:#${s.accent}"></div>
              <div class="settings-skin-name">${s.name}</div>
            </div>
          `).join("")}
        </div>

        <label class="settings-label" style="margin-top:16px">DISPLAY</label>
        <label class="settings-toggle">
          <input type="checkbox" id="settings-scanlines" ${app.skin.scanlineOpacity > 0 ? 'checked' : ''} />
          Scanlines
        </label>
        <label class="settings-toggle">
          <input type="checkbox" id="settings-vignette" ${app.skin.vignetteStrength > 0 ? 'checked' : ''} />
          Vignette
        </label>

        <div class="settings-about">
          <span style="color:#${app.skin.accent}">#0A55</span> v0.1.0<br/>
          Not Only Agent Screen Saver<br/>
          <span style="color:#888">SeMmy + Claude Opus 4.6</span>
        </div>
      </div>
    </div>
  `;

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
