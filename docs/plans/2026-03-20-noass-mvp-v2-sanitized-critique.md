**[TEMPORAL] iOS motion permission has no executable trigger**
- **Failure mode:** On iOS, if `DeviceMotionEvent.requestPermission()` runs outside a direct user gesture, the request is rejected and all accelerometer-driven behavior stays permanently disabled.
- **Where in plan:** `Task 13: Accelerometer Physics Engine` — “iOS requires `DeviceMotionEvent.requestPermission()` (user gesture required).”
- **Severity:** blocking
- **Suggested resolution:** Specify the exact user action that requests motion permission and the fallback state when permission is denied or unavailable.

**[INVARIANT] Gravity vector lacks a normalized coordinate contract**
- **Failure mode:** Different WebViews report motion axes relative to device orientation differently, so the same tilt can push nodes the wrong way or with different strength across Android, iOS, and rotation states.
- **Where in plan:** `Task 13: Accelerometer Physics Engine` — “reads device accelerometer and feeds gravity vector into the existing force-directed graph physics” and “`stepPhysics()` in `graph.ts` adds `gravityX * strength` to each node's velocity.”
- **Severity:** blocking
- **Suggested resolution:** Define one canonical screen-space gravity mapping with axis remapping, units, clamping, and smoothing before physics consumes it.

**[TEMPORAL] Shake detection can retrigger continuously**
- **Failure mode:** A single physical shake can cross the threshold for several consecutive frames, causing repeated scatter impulses that blow the graph apart and prevent it from settling.
- **Where in plan:** `Task 13: Accelerometer Physics Engine` — “Shake - detected via acceleration magnitude threshold, scatters nodes randomly.”
- **Severity:** degrading
- **Suggested resolution:** Add a cooldown or refractory window so one shake produces at most one bounded scatter event.

**[RESOURCE] Performance fallback only covers particles**
- **Failure mode:** On weaker mobile devices, tilt forces, orientation reflow, and graph simulation can still exceed frame budget and battery limits even after particle updates are skipped, because the expensive graph work remains active.
- **Where in plan:** `Task 14: Weather Effects System` — “Skip particle updates if frame time > 33ms,” plus `Task 13` tilt/shake/rotate behaviors.
- **Severity:** blocking
- **Suggested resolution:** Define a cross-feature degradation order with measurable thresholds for disabling weather, motion interaction, or reflow when frame time stays above budget.

**[INTERFACE] Module IDs are not constrained against navigation encoding**
- **Failure mode:** A module `id` containing `:` or colliding with reserved screen names can create ambiguous `module:<id>` routes, breaking lookup, persistence, or route restoration.
- **Where in plan:** `Task 15: Module Registry + Gamification` — `id: string`, `Registry: Map<string, NOASSModule>`, and “Screen state machine extends with `module:<id>` pattern.”
- **Severity:** blocking
- **Suggested resolution:** Constrain valid module IDs and reject duplicates or reserved-prefix collisions at registration time.

**[TEMPORAL] Module lifecycle ordering is unspecified**
- **Failure mode:** If navigation does not guarantee `destroy()` before the next module `init()`, old timers, listeners, animation loops, or audio contexts can continue running and interfere with the active module.
- **Where in plan:** `Task 15: Module Registry + Gamification` — `init(state: AppState): void;` and `destroy(): void;`
- **Severity:** blocking
- **Suggested resolution:** Define the exact enter/exit lifecycle order and require teardown of all module-owned side effects before activating another module.

**[INTERFACE] Shared `AppState` access is unconstrained**
- **Failure mode:** Because every module receives the full `AppState`, one buggy placeholder module can mutate unrelated host state and crash navigation or graph behavior, which is especially risky given the stated lack of sandboxing.
- **Where in plan:** `Task 15: Module Registry + Gamification` — `init(state: AppState)`, `render(..., state: AppState)`, `handleInput(..., state: AppState)` and Open Question 6.
- **Severity:** blocking
- **Suggested resolution:** Define the allowed read/write surface modules get from `AppState` and prevent direct mutation of unrelated host state.

**[FALSIFIABILITY] Achievement unlocks are not operationally testable**
- **Failure mode:** Conditions like “use app after midnight” and “monitor 1M+ context” can be implemented differently by different contributors, leading to modules that never unlock or unlock spuriously with no clear pass/fail check.
- **Where in plan:** `Task 15: Module Registry + Gamification` — “Achievement system tracks user actions” bullets.
- **Severity:** degrading
- **Suggested resolution:** Define concrete events, counters, and persistence rules for each achievement so unlock behavior is deterministic and testable.

### Survivability Assessment
- **Total critiques:** 8 (6 blocking, 2 degrading, 0 cosmetic)
- **Highest-risk area:** `Task 15: Module Registry + Gamification` because the module contract is too loose around IDs, lifecycle, and shared state, so integration failures will surface immediately once more than one module exists.
- **Top 3 risks** that would make you nervous during implementation
- Motion permission succeeds nowhere on iOS because no user-triggered request path is defined.
- Modules leak side effects or corrupt host state because lifecycle and `AppState` ownership are not bounded.
- Navigation breaks on real data because `module:<id>` has no validation or reserved-name rules.
- **Verdict:** This plan probably does not survive first integration without revisions. The first thing likely to break is not rendering polish but contract edges: iOS motion access will fail silently, and the module system will start leaking or colliding as soon as navigation switches between real modules. The Stage 5 ideas are implementable, but Stage 6 currently has the more dangerous hidden assumptions.