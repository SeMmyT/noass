/**
 * @remotion/transitions presentation: dither
 *
 * Floyd-Steinberg 1-bit dithering transition with optional jeans texture.
 * Entering scene materializes from dithered void. Exiting dissolves into noise.
 *
 * Usage:
 *   import { dither } from "@remotion/transitions/dither";
 *   <TransitionSeries.Transition presentation={dither({ aggression: 50, tint: "denim" })} />
 */

import React, { useEffect, useRef, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DitherTint = "none" | "denim" | "gold" | "ember" | "moss" | "denim-gold";

export type DitherProps = {
  /** Destruction intensity 0-100. Higher = more pixels destroyed. Default: 50 */
  aggression?: number;
  /** Color tint applied to destroyed pixels. Default: "none" */
  tint?: DitherTint;
  /** Direction: "materialize" fades IN from dither, "dissolve" fades OUT. Default: "materialize" */
  mode?: "materialize" | "dissolve";
};

interface TransitionPresentationComponentProps<T> {
  children: React.ReactNode;
  presentationDirection: "entering" | "exiting";
  presentationProgress: number;
  passedProps: T;
}

interface TransitionPresentation<T> {
  component: React.FC<TransitionPresentationComponentProps<T>>;
  props: T;
}

// ── Tint presets ──────────────────────────────────────────────────────────────

const TINTS: Record<DitherTint, [number, number, number]> = {
  none: [1.0, 1.0, 1.05],
  denim: [0.4, 0.45, 1.3],
  gold: [1.4, 1.0, 0.3],
  ember: [1.4, 0.5, 0.3],
  moss: [0.4, 1.0, 0.45],
  "denim-gold": [0, 0, 0], // special case handled below
};

// ── Floyd-Steinberg core ──────────────────────────────────────────────────────

function floydSteinbergDither(data: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const old = data[i];
      const val = old > 128 ? 255 : 0;
      const err = old - val;
      data[i] = data[i + 1] = data[i + 2] = val;

      if (x + 1 < w) {
        const j = i + 4;
        data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 7) / 16);
      }
      if (y + 1 < h) {
        if (x > 0) {
          const j = ((y + 1) * w + (x - 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 3) / 16);
        }
        {
          const j = ((y + 1) * w + x) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 5) / 16);
        }
        if (x + 1 < w) {
          const j = ((y + 1) * w + (x + 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + (err * 1) / 16);
        }
      }
    }
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// ── White-destroyer (jeans texture) ───────────────────────────────────────────

function destroyWhites(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  aggression: number,
  tint: DitherTint
): void {
  const thresh = 255 - aggression * 0.8;
  const darkFloor = Math.max(10, 60 - aggression * 0.5);
  const darkCeil = Math.max(25, 80 - aggression * 0.5);

  const isDenimGold = tint === "denim-gold";
  const goldThresh = thresh + (255 - thresh) * 0.7;
  const [rm, gm, bm] = isDenimGold ? [1, 1, 1] : TINTS[tint];

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness > thresh) {
      const t = (brightness - thresh) / (255 - thresh);
      const base = darkFloor + t * (darkCeil - darkFloor);

      let r: number, g: number, b: number;
      if (isDenimGold) {
        if (brightness > goldThresh) {
          r = base * 1.5;
          g = base * 1.1;
          b = base * 0.3;
        } else {
          r = base * 0.4;
          g = base * 0.45;
          b = base * 1.3;
        }
      } else {
        r = base * rm;
        g = base * gm;
        b = base * bm;
      }

      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
    }
  }
}

// ── Presentation component ────────────────────────────────────────────────────

const DitherPresentation: React.FC<TransitionPresentationComponentProps<DitherProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    aggression = 50,
    tint = "none",
    mode = "materialize",
  } = passedProps;

  // Compute effective progress based on direction + mode
  const effectiveAggression = useMemo(() => {
    let p = presentationProgress;

    if (presentationDirection === "exiting") {
      // Exiting: dissolve out
      return p * aggression;
    }

    // Entering
    if (mode === "materialize") {
      // Start fully destroyed, end clean
      return (1 - p) * aggression;
    }
    // dissolve mode on entering = start clean, end destroyed (unusual but supported)
    return p * aggression;
  }, [presentationProgress, presentationDirection, aggression, mode]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    if (effectiveAggression < 1) {
      // Fully visible — hide canvas overlay
      canvasRef.current.style.display = "none";
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr * 0.5); // Half-res for perf
    canvas.height = Math.round(height * dpr * 0.5);
    canvas.style.display = "block";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture current frame from DOM
    // Note: in Remotion's render pipeline, this uses html2canvas or direct capture
    // For the transition overlay, we generate the dither pattern procedurally
    const w = canvas.width;
    const h = canvas.height;

    // Fill with mid-gray proportional to aggression (simulates content being destroyed)
    const gray = Math.round(128 + (effectiveAggression / 100) * 80);
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    floydSteinbergDither(imageData.data, w, h);
    destroyWhites(imageData.data, w, h, effectiveAggression, tint);
    ctx.putImageData(imageData, 0, 0);
  }, [effectiveAggression, tint]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          mixBlendMode: "multiply",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
};

// ── Factory function (matches Remotion transition pattern) ────────────────────

export function dither(props: DitherProps = {}): TransitionPresentation<DitherProps> {
  return {
    component: DitherPresentation,
    props,
  };
}
