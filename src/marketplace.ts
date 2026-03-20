// ── marketplace.ts — Skin marketplace screen (Canvas-rendered) ────────────────

import type { AppState, Skin } from "./types";
import { drawDitheredText, drawDitheredBox, clearTextCache, clearCircleCache } from "./renderer";
import { getBundledSkins } from "./skins";

let scrollY = 0;
let previewSkin: Skin | null = null;
const CARD_GAP = 10;
const COLS = 3;

export function resetMarketplace(): void {
  scrollY = 0;
  previewSkin = null;
}

export function drawMarketplace(app: AppState): void {
  const { ctx, width, height, skin, isMobile } = app;
  const skins = getBundledSkins();
  const activeSkin = previewSkin || skin;

  // Background
  ctx.fillStyle = `#${activeSkin.bgColor}`;
  ctx.fillRect(0, 0, width, height);

  // Header
  drawDitheredBox(ctx, 0, 0, width, isMobile ? 35 : 45, 15);
  drawDitheredText(ctx, "MARKETPLACE", width / 2, isMobile ? 20 : 25, isMobile ? 14 : 18,
    { color: "accent", align: "center", bold: true }, activeSkin);

  // Back hint
  drawDitheredText(ctx, "< BACK", 15, isMobile ? 20 : 25, isMobile ? 9 : 11,
    { color: "white", align: "left" }, activeSkin);

  // Featured row
  const featuredY = isMobile ? 45 : 55;
  drawDitheredText(ctx, "FEATURED", 15, featuredY, isMobile ? 9 : 11,
    { color: "accent", bold: true }, activeSkin);

  const featuredTop = featuredY + 8;
  const featuredH = isMobile ? 50 : 60;

  for (let i = 0; i < Math.min(skins.length, 4); i++) {
    const s = skins[i];
    const fx = 15 + i * (isMobile ? 70 : 90);
    const isActive = s.id === skin.id;

    // Card background
    drawDitheredBox(ctx, fx, featuredTop, isMobile ? 62 : 80, featuredH, isActive ? 35 : 20);

    // Accent swatch
    const accentColor = `#${s.accent}`;
    ctx.fillStyle = accentColor;
    ctx.fillRect(fx + 4, featuredTop + 4, isMobile ? 54 : 72, isMobile ? 20 : 25);

    // Name
    drawDitheredText(ctx, s.name, fx + (isMobile ? 31 : 40), featuredTop + (isMobile ? 35 : 40),
      isMobile ? 7 : 8, { color: "white", align: "center", bold: true }, activeSkin);

    // Active badge
    if (isActive) {
      drawDitheredText(ctx, "ACTIVE", fx + (isMobile ? 31 : 40), featuredTop + (isMobile ? 44 : 52),
        isMobile ? 6 : 7, { color: "accent", align: "center" }, activeSkin);
    }
  }

  // Grid section
  const gridTop = featuredTop + featuredH + 20;
  drawDitheredText(ctx, "ALL SKINS", 15, gridTop, isMobile ? 9 : 11,
    { color: "accent", bold: true }, activeSkin);

  const gridStart = gridTop + 12;
  const colW = (width - 30 - (COLS - 1) * CARD_GAP) / COLS;
  const cardH = isMobile ? 55 : 65;

  for (let i = 0; i < skins.length; i++) {
    const s = skins[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = 15 + col * (colW + CARD_GAP);
    const cy = gridStart + row * (cardH + CARD_GAP) - scrollY;

    if (cy + cardH < 0 || cy > height) continue; // Cull

    const isActive = s.id === skin.id;
    const isPreviewing = previewSkin?.id === s.id;

    // Card
    drawDitheredBox(ctx, cx, cy, colW, cardH, isPreviewing ? 40 : isActive ? 30 : 18);

    // Accent bar
    ctx.fillStyle = `#${s.accent}`;
    ctx.fillRect(cx + 3, cy + 3, colW - 6, isMobile ? 16 : 20);

    // Name
    drawDitheredText(ctx, s.name, cx + colW / 2, cy + (isMobile ? 28 : 32),
      isMobile ? 7 : 9, { color: "white", align: "center", bold: true }, activeSkin);

    // Author
    drawDitheredText(ctx, s.author, cx + colW / 2, cy + (isMobile ? 37 : 42),
      isMobile ? 6 : 7, { color: "white", align: "center" }, activeSkin);

    // Status
    if (isActive) {
      drawDitheredText(ctx, "APPLIED", cx + colW / 2, cy + (isMobile ? 46 : 54),
        isMobile ? 6 : 7, { color: "accent", align: "center", bold: true }, activeSkin);
    } else {
      drawDitheredText(ctx, "TAP TO PREVIEW", cx + colW / 2, cy + (isMobile ? 46 : 54),
        isMobile ? 5 : 6, { color: "white", align: "center" }, activeSkin);
    }
  }

  // Preview mode banner
  if (previewSkin) {
    const bannerY = height - (isMobile ? 50 : 60);
    drawDitheredBox(ctx, 0, bannerY, width, isMobile ? 50 : 60, 25);
    drawDitheredText(ctx, `PREVIEWING: ${previewSkin.name.toUpperCase()}`, width / 2, bannerY + (isMobile ? 15 : 18),
      isMobile ? 10 : 12, { color: "accent", align: "center", bold: true }, activeSkin);
    drawDitheredText(ctx, "TAP AGAIN TO APPLY  |  BACK TO CANCEL", width / 2, bannerY + (isMobile ? 30 : 38),
      isMobile ? 7 : 9, { color: "white", align: "center" }, activeSkin);
  }
}

export function handleMarketplaceTap(app: AppState, mx: number, my: number): boolean {
  const { isMobile, width } = app;
  const skins = getBundledSkins();

  // Back button
  if (my < (isMobile ? 35 : 45) && mx < 80) {
    previewSkin = null;
    return false; // signal: go back
  }

  // Grid hits
  const gridTop = (isMobile ? 45 : 55) + 8 + (isMobile ? 50 : 60) + 20 + 12;
  const colW = (width - 30 - (COLS - 1) * CARD_GAP) / COLS;
  const cardH = isMobile ? 55 : 65;

  for (let i = 0; i < skins.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = 15 + col * (colW + CARD_GAP);
    const cy = gridTop + row * (cardH + CARD_GAP) - scrollY;

    if (mx >= cx && mx <= cx + colW && my >= cy && my <= cy + cardH) {
      const s = skins[i];
      if (previewSkin?.id === s.id) {
        // Second tap = apply
        app.skin = s;
        previewSkin = null;
        clearTextCache();
        clearCircleCache();
      } else {
        // First tap = preview
        previewSkin = s;
      }
      return true; // stay on marketplace
    }
  }

  return true;
}

export function handleMarketplaceScroll(dy: number): void {
  scrollY = Math.max(0, scrollY + dy);
}
