// ── graph.ts — Node Graph Visualization ──────────────────────────────────────
// Force-directed layout. Nodes pulse. Connections stipple. Everything dithers.

import type { AppState, GraphNode } from "./types";
import {
  drawDitheredText,
  drawDitheredCircle,
  drawAccentRing,
  drawStippledLine,
  clearCircleCache,
} from "./renderer";

interface GraphConfig {
  repulsion: number;
  attraction: number;
  damping: number;
  centerGravity: number;
  minRadius: number;
  maxRadius: number;
  pulseAmp: number;
  pulseHz: number;
}

function getGraphConfig(app: AppState): GraphConfig {
  const mobile = app.isMobile;
  return {
    repulsion: mobile ? 4000 : 8000,
    attraction: 0.003,
    damping: 0.92,
    centerGravity: mobile ? 0.001 : 0.0005,
    minRadius: mobile ? 16 : 22,
    maxRadius: mobile ? 38 : 60,
    pulseAmp: mobile ? 2 : app.skin.pulseAmp,
    pulseHz: app.skin.pulseHz,
  };
}

export function updateGraph(app: AppState): void {
  if (!app.state || !app.state.panes) return;

  const panes = app.state.panes;
  const existing = new Map(app.nodes.map((n) => [n.pane.name, n]));
  const cfg = getGraphConfig(app);

  const newNodes: GraphNode[] = [];
  for (const pane of panes) {
    const prev = existing.get(pane.name);
    const radius = cfg.minRadius + (pane.ctx_k / 800) * (cfg.maxRadius - cfg.minRadius);

    if (prev) {
      prev.pane = pane;
      prev.targetRadius = radius;
      newNodes.push(prev);
    } else {
      const cx = app.width / 2;
      const cy = app.height / 2;
      newNodes.push({
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        radius: radius,
        targetRadius: radius,
        pane: pane,
      });
    }
  }

  app.nodes = newNodes;

  // Validate selectedNode
  if (app.selectedNode) {
    const stillExists = newNodes.some((n) => n.pane.name === app.selectedNode!.pane.name);
    if (!stillExists) {
      app.selectedNode = null;
      app.showContextMenu = false;
    }
  }

  clearCircleCache();
}

function stepPhysics(app: AppState): void {
  const cfg = getGraphConfig(app);
  const nodes = app.nodes;
  const logH = app.isMobile ? 100 : 150;
  const topH = app.isMobile ? 30 : 45;
  const cx = app.width / 2;
  const cy = (app.height - logH) / 2 + topH;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];

    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;
      const minDist = a.radius + b.radius + 20;
      if (dist < minDist * 3) {
        const force = cfg.repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    const dcx = cx - a.x;
    const dcy = cy - a.y;
    a.vx += dcx * cfg.centerGravity;
    a.vy += dcy * cfg.centerGravity;

    if (a.pane.alive) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        if (!b.pane.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 100) {
          a.vx += dx * cfg.attraction;
          a.vy += dy * cfg.attraction;
        }
      }
    }
  }

  for (const n of nodes) {
    n.vx *= cfg.damping;
    n.vy *= cfg.damping;
    n.x += n.vx;
    n.y += n.vy;

    n.radius += (n.targetRadius - n.radius) * 0.1;

    const margin = n.radius + 10;
    const topBound = (app.isMobile ? 35 : 50) + margin;
    const bottomBound = app.height - (app.isMobile ? 110 : 160) - margin;
    if (n.x < margin) { n.x = margin; n.vx *= -0.5; }
    if (n.x > app.width - margin) { n.x = app.width - margin; n.vx *= -0.5; }
    if (n.y < topBound) { n.y = topBound; n.vy *= -0.5; }
    if (n.y > bottomBound) { n.y = bottomBound; n.vy *= -0.5; }
  }
}

export function drawGraph(app: AppState): void {
  stepPhysics(app);

  const cfg = getGraphConfig(app);
  const ctx = app.ctx;
  const nodes = app.nodes;
  const skin = app.skin;
  const t = app.time / 1000;
  const m = app.isMobile;
  const fs = m ? 9 : 11;
  const fss = m ? 7 : 9;
  const accentColor = `#${skin.accent}`;

  // ── Connection lines between alive nodes ───────────────────────────
  const alive = nodes.filter((n) => n.pane.alive);
  const maxDist = m ? 250 : 400;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const alpha = Math.max(0.05, 0.3 - dist / 1500);
        drawStippledLine(
          ctx, a.x, a.y, b.x, b.y,
          `rgba(${skin.accentRGB.r},${skin.accentRGB.g},${skin.accentRGB.b},${alpha})`,
          skin.connectionGap
        );
      }
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────
  for (const node of nodes) {
    const p = node.pane;
    const pulse = p.alive ? Math.sin(t * Math.PI * 2 * cfg.pulseHz + node.x * 0.01) * cfg.pulseAmp : 0;
    const r = node.radius + pulse;

    const fillGray = p.alive ? skin.nodeAliveGray : skin.nodeDeadGray;
    drawDitheredCircle(ctx, node.x, node.y, r, fillGray);

    const progress = Math.min(p.ctx_k / 800, 1);
    drawAccentRing(ctx, node.x, node.y, r, progress, skin);

    if (app.selectedNode === node) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Center content: ETA or DEAD or ctx%
    if (!p.alive) {
      drawDitheredText(ctx, "DEAD", node.x, node.y + 2, m ? 8 : 10, { color: "white", align: "center", bold: true }, skin);
    } else if (p.eta_800k_min != null && p.eta_800k_min > 0) {
      const etaText = p.eta_800k_min < 60
        ? `${Math.round(p.eta_800k_min)}m`
        : `${(p.eta_800k_min / 60).toFixed(1)}h`;
      drawDitheredText(ctx, etaText, node.x, node.y - 2, m ? 10 : 13, { color: "accent", align: "center", bold: true }, skin);
      drawDitheredText(ctx, "ETA", node.x, node.y + (m ? 9 : 12), m ? 6 : 8, { color: "white", align: "center" }, skin);
    } else if (p.ctx_pct > 0) {
      drawDitheredText(ctx, `${p.ctx_pct}%`, node.x, node.y + 2, m ? 9 : 11, { color: "accent", align: "center", bold: true }, skin);
    }

    // Name label below
    drawDitheredText(ctx, p.name, node.x, node.y + r + (m ? 12 : 16), fs, { color: "white", align: "center", bold: true }, skin);

    // Rate + context below name
    if (p.rate_k_per_min && p.alive) {
      drawDitheredText(ctx, `${p.rate_k_per_min}k/min`, node.x, node.y + r + (m ? 22 : 30), fss, { color: "accent", align: "center" }, skin);
    }

    // Context k above
    drawDitheredText(ctx, `${Math.round(p.ctx_k)}k`, node.x, node.y - r - (m ? 7 : 10), fss, { color: "accent", align: "center" }, skin);

    if (app.selectedNode === node && p.last) {
      const maxLen = m ? 18 : 25;
      const lastText = p.last.length > maxLen ? p.last.substring(0, maxLen - 3) + "..." : p.last;
      drawDitheredText(ctx, lastText, node.x, node.y + r + (m ? 32 : 44), fss, { color: "white", align: "center" }, skin);
    }
  }
}
