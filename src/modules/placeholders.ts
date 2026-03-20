// ── modules/placeholders.ts — Stub modules for future project integration ─────

import type { NOASSModule } from "./types";
import { drawDitheredText } from "../renderer";

function makePlaceholder(id: string, name: string, icon: string, desc: string, hidden = false): NOASSModule {
  return {
    id,
    name,
    icon,
    description: desc,
    hidden,
    init() {},
    render(ctx, moduleCtx) {
      const { width, height, skin, isMobile } = moduleCtx;
      ctx.fillStyle = `#${skin.bgColor}`;
      ctx.fillRect(0, 0, width, height);
      drawDitheredText(ctx, icon, width / 2, height / 2 - 30, 40, { color: "accent", align: "center" }, skin);
      drawDitheredText(ctx, name.toUpperCase(), width / 2, height / 2 + 20, isMobile ? 14 : 18, { color: "accent", align: "center", bold: true }, skin);
      drawDitheredText(ctx, "COMING SOON", width / 2, height / 2 + 45, isMobile ? 10 : 12, { color: "white", align: "center" }, skin);
      drawDitheredText(ctx, desc, width / 2, height / 2 + 65, isMobile ? 8 : 9, { color: "white", align: "center" }, skin);
    },
    handleInput() { return false; },
    destroy() {},
  };
}

export const PLACEHOLDER_MODULES: NOASSModule[] = [
  makePlaceholder("orchestra", "Orchestra", "♪", "NeoOrchestra/Strudel live coding audio"),
  makePlaceholder("voice", "Voice", "◎", "ReVisper speech-to-text"),
  makePlaceholder("ghost-hunt", "Ghost Hunt", "👻", "Dithered co-op maze game", true),
  makePlaceholder("hackrf", "HackRF", "📡", "Spectrum dashboard", true),
  makePlaceholder("crawler", "Crawler", "🕸", "Web crawler status"),
];
