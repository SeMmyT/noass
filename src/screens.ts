// ── screens.ts — Screen state machine + navigation ────────────────────────────

export type Screen = "dashboard" | "settings" | "marketplace" | "read-overlay";

let screenStack: Screen[] = ["dashboard"];

export function currentScreen(): Screen {
  return screenStack[screenStack.length - 1];
}

export function pushScreen(screen: Screen): void {
  if (currentScreen() !== screen) {
    screenStack.push(screen);
  }
}

export function popScreen(): Screen {
  if (screenStack.length > 1) {
    screenStack.pop();
  }
  return currentScreen();
}

export function resetToScreen(screen: Screen): void {
  screenStack = [screen];
}

export function isOnDashboard(): boolean {
  return currentScreen() === "dashboard";
}
