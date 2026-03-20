**[INTERFACE] `read` flow has no response contract**
- **Failure mode:** The client can send `{"type":"read"}` but has no defined server response shape for transcript content, so `read-overlay` cannot render anything or distinguish success from error.
- **Where in plan:** `Key Interfaces → WebSocket Protocol (Client → Server)` and `Stage 3 — Marketplace (Tasks 7-8), Task 8 "Navigation — ... read-overlay"`
- **Severity:** blocking
- **Suggested resolution:** Define the server→client message(s) for `read` results and failures before implementing the overlay.

**[COUPLING] “Thin shell” conflicts with planned mobile-native behavior**
- **Failure mode:** The MVP assumes no custom Rust/native work, but `Wake Lock`, Android back handling, cleartext/ATS exceptions, and haptics may require Tauri mobile plugins or platform-specific code; that breaks the delivery sequence once web-only implementation hits unsupported APIs.
- **Where in plan:** `Architecture Overview → Backend (Tauri/Rust): Thin shell — ... No custom Rust commands in MVP`, `Stage 1 — Core, Task 4`, `Stage 3 — Marketplace, Task 8`, and `Stage 4 — Build, Task 12`
- **Severity:** blocking
- **Suggested resolution:** Validate each planned mobile capability against actual Tauri 2 mobile support and explicitly mark any native/plugin work as scope before implementation starts.

**[INVARIANT] Node identity is underspecified across updates**
- **Failure mode:** If `panes` reorder, an agent is renamed, or `idx` is reused after a restart, `selectedNode` and context-menu actions can target the wrong agent, including sending `kill`/`nudge` to the wrong session.
- **Where in plan:** `Key Interfaces → WebSocket Protocol (Server → Client)` and `Key Interfaces → AppState (global mutable state)`
- **Severity:** blocking
- **Suggested resolution:** State a single stable identity key for panes and the reconciliation rule the client must preserve across all state updates.

**[TEMPORAL] Reconnect logic has no stale-state guard**
- **Failure mode:** After network drops or app resume, the client can reconnect and render an older `state` message after a newer one because the protocol defines no sequence/version field, producing backward-moving stats, resurrected panes, or stale selections.
- **Where in plan:** `Stage 1 — Core, Task 4 "Main entry + WS client — ... auto-reconnect"` and `Key Interfaces → WebSocket Protocol (Server → Client)`
- **Severity:** degrading
- **Suggested resolution:** Add a monotonic version or timestamp rule so the client can reject older snapshots after reconnects.

**[RESOURCE] Core rendering has no bounded performance budget**
- **Failure mode:** Full-canvas Floyd-Steinberg dithering plus force-directed layout, scanlines, vignette, and live graph updates can drop well below usable frame rate on mid-range Android devices, making taps and gestures unreliable.
- **Where in plan:** `Stage 1 — Core, Task 2`, `Stage 1 — Core, Task 3`, `Stage 1 — Core, Task 4`, and `Open Questions, item 2`
- **Severity:** blocking
- **Suggested resolution:** Define concrete frame-time and memory budgets, plus the exact degradation behavior when the budget is exceeded, before porting all visual effects.

**[INTERFACE] Settings input depends on an unvalidated WebView behavior**
- **Failure mode:** If the hidden `<input>` does not reliably summon the soft keyboard, loses focus behind the canvas, or gets obscured on Android, users cannot enter or edit the WS URL and the app cannot be configured in practice.
- **Where in plan:** `Stage 2 — Theming, Task 6 "Settings screen"` and `Open Questions, item 1`
- **Severity:** blocking
- **Suggested resolution:** Resolve the hidden-input keyboard/focus behavior on target Android WebView before treating the settings drawer as implementable.

**[FALSIFIABILITY] Mock mode can pass while real protocol still fails**
- **Failure mode:** A hand-authored mock generator can omit empty arrays, malformed events, oversized logs, missing fields, or delayed updates, so the UI looks finished in demo mode but breaks immediately against the host server.
- **Where in plan:** `Stage 4 — Build, Task 9 "Mock data mode"` and `Key Interfaces → WebSocket Protocol (Server → Client)`
- **Severity:** degrading
- **Suggested resolution:** Require mock payloads to be derived from recorded real server samples that include edge cases, not from idealized hand-written objects.

### Survivability Assessment
- **Total critiques:** 7 (5 blocking, 2 degrading, 0 cosmetic)
- **Highest-risk area:** `Stage 1 — Core` plus `Key Interfaces`, because protocol gaps and mobile capability assumptions sit underneath every later stage and will invalidate downstream work if wrong.
- **Top 3 risks** that would make you nervous during implementation
  - The `read-overlay` ships into a protocol hole because no response/error contract exists for `read`
  - The “thin shell” assumption collapses once wake lock, back handling, or haptics need native support
  - The rendering pipeline misses mobile performance targets and makes the core dashboard unusable
- **Verdict:** This plan is directionally coherent, but it does not yet look survivable against a real codebase because several core assumptions are still implicit instead of bounded. The first thing likely to break is not theming or marketplace work; it is the Stage 1 foundation: either the client/server contract proves insufficient for real interactions, or the web-only mobile assumptions fail as soon as you try to implement platform behaviors and usable text input.