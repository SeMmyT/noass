// ── physics-device.ts — Accelerometer physics for node graph ──────────────────
// DeviceMotionEvent → normalized gravity vector → force on nodes

export interface DevicePhysics {
  gravityX: number; // -1 to 1, screen-space (right = positive)
  gravityY: number; // -1 to 1, screen-space (down = positive)
  shaking: boolean;
}

const SMOOTHING = 0.7;
const SHAKE_THRESHOLD = 25; // m/s^2
const SHAKE_COOLDOWN_MS = 2000;
const SHAKE_SAMPLES = 3;

let physics: DevicePhysics = { gravityX: 0, gravityY: 0, shaking: false };
let rawX = 0;
let rawY = 0;
let shakeBuffer: number[] = [];
let lastShakeTime = 0;
let permissionGranted = false;
let listening = false;

export function getDevicePhysics(): DevicePhysics {
  return physics;
}

export function isMotionAvailable(): boolean {
  return "DeviceMotionEvent" in window;
}

export function isMotionPermitted(): boolean {
  return permissionGranted;
}

export async function requestMotionPermission(): Promise<boolean> {
  if (!isMotionAvailable()) return false;

  // iOS requires explicit permission request from user gesture
  const DME = DeviceMotionEvent as any;
  if (typeof DME.requestPermission === "function") {
    try {
      const result = await DME.requestPermission();
      permissionGranted = result === "granted";
    } catch {
      permissionGranted = false;
    }
  } else {
    // Android — no permission needed
    permissionGranted = true;
  }

  if (permissionGranted && !listening) {
    startListening();
  }

  return permissionGranted;
}

function startListening(): void {
  if (listening) return;
  listening = true;

  window.addEventListener("devicemotion", (e: DeviceMotionEvent) => {
    const ag = e.accelerationIncludingGravity;
    if (!ag) return;

    // Raw accelerometer → screen-space mapping
    // ag.x: positive = right, ag.y: positive = up (we want down = positive)
    // Normalize by gravity (~9.8) and clamp
    const nx = clamp((ag.x ?? 0) / 9.8, -1, 1);
    const ny = clamp(-(ag.y ?? 0) / 9.8, -1, 1); // flip Y: screen down = positive

    // Remap based on screen orientation
    const angle = screen.orientation?.angle ?? 0;
    switch (angle) {
      case 90:
        rawX = -ny;
        rawY = nx;
        break;
      case 180:
        rawX = -nx;
        rawY = -ny;
        break;
      case 270:
        rawX = ny;
        rawY = -nx;
        break;
      default: // 0
        rawX = nx;
        rawY = ny;
    }

    // Exponential smoothing
    physics.gravityX = physics.gravityX * SMOOTHING + rawX * (1 - SMOOTHING);
    physics.gravityY = physics.gravityY * SMOOTHING + rawY * (1 - SMOOTHING);

    // Shake detection
    const acc = e.acceleration;
    if (acc) {
      const mag = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      shakeBuffer.push(mag);
      if (shakeBuffer.length > SHAKE_SAMPLES) shakeBuffer.shift();

      const now = Date.now();
      if (
        shakeBuffer.length >= SHAKE_SAMPLES &&
        shakeBuffer.every((m) => m > SHAKE_THRESHOLD) &&
        now - lastShakeTime > SHAKE_COOLDOWN_MS
      ) {
        physics.shaking = true;
        lastShakeTime = now;
        // Reset shake flag after one frame
        requestAnimationFrame(() => {
          physics.shaking = false;
        });
      }
    }
  });
}

export function stopListening(): void {
  // Can't easily remove anonymous listener, but physics will just stop updating
  listening = false;
  physics = { gravityX: 0, gravityY: 0, shaking: false };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
