# NOASS — Architecture Review Document

## Goal
A Tauri 2 mobile app (Android primary, iOS prep) that wraps a 1-bit dithered Canvas dashboard for monitoring remote agent sessions — with a skins/theming system and skin marketplace.

## Architecture Overview

```
┌──────────────────┐       WebSocket        ┌───────────────┐
│  Mobile App      │◄─────────────────────► │  Host Server  │
│  (Tauri 2 +      │    ws://host:3333      │  (Node.js)    │
│   WebView +      │                        │  polls agent  │
│   Canvas)        │                        │  runtime via  │
│                  │                        │  shell exec   │
└──────────────────┘                        └───────────────┘
```

- **Frontend:** Single HTML Canvas, everything rendered via Floyd-Steinberg dithering engine (1-bit aesthetic). Force-directed node graph, stats bar, event log, context menu.
- **Backend (Tauri/Rust):** Thin shell — just Tauri plugin registration (store for settings persistence). No custom Rust commands in MVP.
- **Server (stays on host):** Existing Node.js WebSocket server. Polls agent runtime every 2s, broadcasts JSON state. Accepts commands (nudge, kill, read, revive).
- **Mobile acts as pure WS client** connecting to server's IP:port.

## Tech Stack
- Tauri 2 (Rust + WebView)
- Vite 6 + TypeScript
- Canvas API (no framework, no DOM rendering)
- WebSocket (native browser API)
- tauri-plugin-store (settings persistence)

## Staged Plan

### Stage 1 — Core (Tasks 1-4)
1. **Scaffold** — Tauri 2 project with Vite + TS
2. **Port dither engine** — Floyd-Steinberg, text/circle caches, scanlines, vignette → TypeScript modules
3. **Port graph/UI/controls** — Force-directed layout, stats bar, log panel, click handling, context menu, keyboard shortcuts → TypeScript
4. **Main entry + WS client** — App init, render loop, WebSocket connection with auto-reconnect, Wake Lock

### Stage 2 — Theming (Tasks 5-6)
5. **Skins bundle** — 6 built-in skins as TypeScript objects. Skin = JSON manifest controlling: accent color, node grays, scanline opacity/gap, vignette strength, CRT curvature, pulse Hz/amp, font family, connection style. All rendering functions accept Skin parameter.
6. **Settings screen** — Canvas-rendered slide-in drawer. Hidden `<input>` for text entry (WS URL). Skin selector grid. Persist via tauri-plugin-store.

### Stage 3 — Marketplace (Tasks 7-8)
7. **Marketplace screen** — Canvas-rendered. Bundled catalog for MVP (same skins array). Featured row + grid layout. Tap to live-preview, "Apply" to persist. Architecture supports remote catalog JSON later.
8. **Navigation** — Screen state machine: dashboard | settings | marketplace | read-overlay. Swipe gestures + Android back button.

### Stage 4 — Build (Tasks 9-12)
9. **Mock data mode** — Client-side mock pane generator for demo/screenshots when no server available.
10. **Android build** — `tauri android init`, configure manifest (cleartext traffic, portrait orientation), generate icons, build debug APK.
11. **iOS prep** — `tauri ios init`, configure plist (ATS exception for local WS), generate Xcode project. Build deferred to macOS machine.
12. **Polish** — FPS profiling, dither cache management on skin switch, connection status indicator, haptic feedback on tap, README.

## Key Interfaces

### WebSocket Protocol (Server → Client)
```json
{
  "type": "state",
  "panes": [
    {"idx": 1, "name": "agent-a", "alive": true, "ctx_k": 245.3, "last": "writing...", "rate_k_per_min": 12.3, "eta_800k_min": 45, "ctx_pct": 30.7}
  ],
  "log": [{"event": "new_pane", "name": "agent-a", "timestamp": 1711000000000}],
  "stats": {"total_panes": 5, "alive": 3, "dead": 2, "total_ctx_k": 1234.5, "uptime_sec": 8100}
}
```

### WebSocket Protocol (Client → Server)
```json
{"type": "nudge", "target": "agent-a", "message": "Ship it"}
{"type": "kill", "target": "agent-a"}
{"type": "read", "target": "agent-a", "lines": 50}
{"type": "revive", "target": "agent-a"}
```

### Skin Interface
```typescript
interface Skin {
  id: string; name: string; author: string; version: string; description: string;
  accent: string; accentRGB: {r,g,b};
  nodeAliveGray: number; nodeDeadGray: number; bgColor: string;
  scanlineOpacity: number; scanlineGap: number; vignetteStrength: number;
  crtCurvature: boolean; pulseHz: number; pulseAmp: number;
  fontFamily: string; connectionStyle: "stippled"|"solid"|"dashed"; connectionGap: number;
}
```

### AppState (global mutable state)
```typescript
interface AppState {
  ws: WebSocket | null;
  state: StateMessage | null;
  skin: Skin;
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  showContextMenu: boolean;
  paused: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  // ...screen, dimensions, timing
}
```

## Open Questions
1. Canvas text input on mobile — hidden `<input>` approach viable in Tauri 2 WebView?
2. Floyd-Steinberg performance on mobile WebView — can we hit 30fps with caching?
3. Google Fonts (IBM Plex Mono) loading in offline Android app — bundle or system fallback?
4. Tauri store plugin — any async initialization gotchas on Android cold start?
5. WebSocket over local network — does Android WebView honor Tauri CSP for ws: connections?

## Dependency Graph
```
T1 → T2 → T3 → T4 ─┬─ T5 → T6 → T7 → T8
                     ├─ T9
                     ├─ T10
                     └─ T11
All → T12
```
