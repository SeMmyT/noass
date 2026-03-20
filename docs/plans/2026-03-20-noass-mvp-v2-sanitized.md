# NOASS v2 - Architecture Review (Stages 5-6 Addition)

## Context
This is a DELTA review. Stages 1-4 (12 tasks) were previously reviewed and hardened. This review covers only the NEW additions:
- Stage 5: Accelerometer/gyroscope physics + weather particle effects
- Stage 6: EEOAO module system (plugin architecture for absorbing other projects)

The base plan (Stages 1-4) remains unchanged.

## New Stage 5 - Physics (Tasks 13-14)

### Task 13: Accelerometer Physics Engine

**Interface:** `DeviceMotionEvent` API in WebView

New module `physics-device.ts` reads device accelerometer and feeds gravity vector into the existing force-directed graph physics. Three behaviors:
- **Tilt** - nodes slide in direction of gravity (additive force on existing spring model)
- **Shake** - detected via acceleration magnitude threshold, scatters nodes randomly
- **Rotate** - graph reflows on orientation change

Skin interface extended with:
```typescript
deviceGravityStrength: number;  // 0=disabled, 1=normal, 2=heavy
friction: number;               // 0-1
bounciness: number;             // 0-1, wall bounce coefficient
```

Physics integration point: `stepPhysics()` in graph.ts adds `gravityX * strength` to each node's velocity.

iOS requires `DeviceMotionEvent.requestPermission()` (user gesture required).

### Task 14: Weather Effects System

Particle system overlaid on the canvas. 6 weather types:
- Rain (vertical streaks), Snow (slow drift), Static (TV noise), Matrix (falling chars), Sparks (upward from alive nodes), None

Particle struct: `{x, y, vx, vy, life, maxLife, size}`. Max 200 particles on mobile.

Weather reacts to accelerometer - rain falls sideways when tilted, shake triggers gust.

Skin interface extended:
```typescript
weather: "none"|"rain"|"snow"|"static"|"matrix"|"sparks";
weatherDensity: number;      // 0-1
weatherSpeed: number;        // 0-2
weatherInteractive: boolean; // respond to accelerometer
```

Performance rule: particles rendered as single pixels (no per-particle dithering). Skip particle updates if frame time > 33ms.

## New Stage 6 - EEOAO Module System (Task 15)

### Task 15: Module Registry + Gamification

Plugin architecture for absorbing other projects as "screens" inside the app.

**Module interface:**
```typescript
interface NOASSModule {
  id: string;
  name: string;
  icon: string;
  description: string;
  screen: string;        // registered screen ID
  hidden: boolean;       // unlockable via gameplay
  unlockCondition?: string;
  init(state: AppState): void;
  render(ctx: CanvasRenderingContext2D, state: AppState): void;
  handleInput(event: InputEvent, state: AppState): boolean;
  destroy(): void;
}
```

**Registry:** `Map<string, NOASSModule>` with register/get/list operations.

**Navigation:** Screen state machine extends with `module:<id>` pattern. Module grid shown in navigation drawer.

**Gamification:** Achievement system tracks user actions:
- Kill an agent, use app after midnight, monitor 1M+ context, apply 3 skins
- Achievements unlock hidden modules

**Placeholder modules** (render "Coming Soon"):
- orchestra (live coding audio)
- voice (speech-to-text)
- ghost-hunt (game viewer)
- hackrf (spectrum dashboard)
- crawler (web crawler status)

Each becomes real when its project code is ported into the module interface.

## Dependency Graph (Stages 5-6 only)

```
Task 3 (graph physics) ─── Task 13 (accelerometer) ─── Task 14 (weather)
Task 8 (navigation)    ─── Task 15 (EEOAO modules)
Task 12 (polish)       ─── after all above
```

Tasks 13-14 can run parallel with Tasks 7-8.
Task 15 requires Task 8 (navigation) complete.

## Open Questions (New)
1. Does `DeviceMotionEvent` work reliably in Tauri 2 Android WebView?
2. iOS permission flow for motion sensors - does Tauri handle the user gesture requirement?
3. Module hot-loading vs compiled-in - for MVP, modules are compiled in. Hot-loading deferred.
4. Achievement persistence - share same tauri-plugin-store or separate store?
5. Weather particle count vs battery drain on mobile - need profiling.
6. Module isolation - can a buggy module crash the whole app? No sandboxing in MVP.
