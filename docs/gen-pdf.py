#!/usr/bin/env python3
"""Generate Satisfactory-style PDF for NOASS project brief v2.
   Auto-calculates image heights to prevent text overlap."""

import os
from PIL import Image as PILImage
from fpdf import FPDF

ASSETS = os.path.join(os.path.dirname(__file__), "assets")
OUT = os.path.join(os.path.dirname(__file__), "NOASS-Project-Brief.pdf")

BG = (18, 18, 24)
PANEL = (28, 28, 38)
ACCENT = (255, 160, 0)
GREEN = (0, 255, 65)
WHITE = (220, 220, 230)
DIM = (120, 120, 140)
BORDER = (50, 50, 65)
RED = (255, 60, 60)
CYAN = (0, 212, 255)


def img_height_mm(path, target_w_mm):
    """Calculate actual height in mm for an image placed at target_w_mm width."""
    im = PILImage.open(path)
    w, h = im.size
    return target_w_mm * (h / w)


class SatisfactoryPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=False)
        reg = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
        bold = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"
        self.add_font("Mono", "", reg)
        self.add_font("Mono", "B", bold)
        self.fn = "Mono"

    def new_page(self):
        self.add_page()
        self.set_fill_color(*BG)
        self.rect(0, 0, 210, 297, "F")

    def panel(self, x, y, w, h):
        self.set_fill_color(*PANEL)
        self.set_draw_color(*BORDER)
        self.rect(x, y, w, h, "DF")

    def accent_line(self, x, y, w):
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.8)
        self.line(x, y, x + w, y)
        self.set_line_width(0.2)

    def hdr(self, text):
        y = self.get_y()
        self.set_font(self.fn, "B", 14)
        self.set_text_color(*ACCENT)
        self.cell(0, 8, text.upper(), new_x="LMARGIN", new_y="NEXT")
        self.accent_line(self.l_margin, y + 9, 180)
        self.ln(3)

    def txt(self, text, sz=9):
        self.set_font(self.fn, "", sz)
        self.set_text_color(*WHITE)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bul(self, text, indent=15):
        if self.get_y() > 275:
            self.new_page()
            self.set_y(15)
        self.set_font(self.fn, "B", 9)
        self.set_text_color(*ACCENT)
        self.set_xy(indent, self.get_y())
        self.cell(5, 5, ">")
        self.set_font(self.fn, "", 9)
        self.set_text_color(*WHITE)
        self.set_xy(indent + 6, self.get_y())
        self.multi_cell(180 - indent, 5, text)
        self.ln(1)

    def stat_box(self, x, y, w, h, label, value, color=ACCENT):
        self.panel(x, y, w, h)
        self.set_xy(x + 2, y + 2)
        self.set_font(self.fn, "", 7)
        self.set_text_color(*DIM)
        self.cell(w - 4, 4, label.upper())
        self.set_xy(x + 2, y + 7)
        self.set_font(self.fn, "B", 16)
        self.set_text_color(*color)
        self.cell(w - 4, 10, str(value))

    def task_row(self, num, name, status, risk="LOW"):
        y = self.get_y()
        if y > 272:
            self.new_page()
            self.set_y(15)
            y = 15
        colors = {"LOW": GREEN, "MED": ACCENT, "HIGH": RED}
        scol = {"TODO": DIM, "READY": GREEN, "BLOCKED": RED}
        self.panel(15, y, 180, 10)
        self.set_xy(17, y + 1)
        self.set_font(self.fn, "B", 9)
        self.set_text_color(*ACCENT)
        self.cell(12, 8, f"T{num:02d}")
        self.set_font(self.fn, "", 9)
        self.set_text_color(*WHITE)
        self.cell(108, 8, name)
        self.set_font(self.fn, "B", 8)
        self.set_text_color(*colors.get(risk, DIM))
        self.cell(22, 8, risk)
        self.set_text_color(*scol.get(status, DIM))
        self.cell(28, 8, status, align="R")
        self.set_y(y + 12)

    def issue_row(self, title, fix):
        if self.get_y() > 268:
            self.new_page()
            self.set_y(15)
        self.set_font(self.fn, "B", 8)
        self.set_text_color(*RED)
        self.cell(0, 5, f"  {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_font(self.fn, "", 8)
        self.set_text_color(*GREEN)
        self.multi_cell(0, 4, f"    FIX: {fix}")
        self.ln(2)

    def place_img(self, name, x, y, w, margin_below=5):
        """Place image and return the y position BELOW it."""
        path = os.path.join(ASSETS, name)
        if not os.path.exists(path):
            return y + 10
        h = img_height_mm(path, w)
        self.image(path, x=x, y=y, w=w)
        return y + h + margin_below

    def footer_text(self, text):
        self.set_y(285)
        self.set_font(self.fn, "", 7)
        self.set_text_color(*DIM)
        self.cell(0, 4, text, align="C")


def build():
    p = SatisfactoryPDF()

    # ========== PAGE 1: COVER ==========
    p.new_page()
    next_y = p.place_img("noass-logo.png", 65, 15, 80, margin_below=5)
    p.set_y(next_y)
    p.set_font(p.fn, "B", 30)
    p.set_text_color(*ACCENT)
    p.cell(0, 14, "#0A55", align="C", new_x="LMARGIN", new_y="NEXT")
    p.set_font(p.fn, "", 11)
    p.set_text_color(*WHITE)
    p.cell(0, 7, "Not Only Agent Screen Saver", align="C", new_x="LMARGIN", new_y="NEXT")
    p.ln(4)
    p.set_font(p.fn, "", 8)
    p.set_text_color(*DIM)
    p.cell(0, 5, "PROJECT BRIEF v2.0  |  2026-03-20  |  CLASSIFIED: INTERNAL", align="C", new_x="LMARGIN", new_y="NEXT")

    p.accent_line(40, p.get_y() + 3, 130)

    tag_y = p.get_y() + 8
    p.panel(30, tag_y, 150, 30)
    p.set_xy(35, tag_y + 3)
    p.set_font(p.fn, "", 9)
    p.set_text_color(*GREEN)
    p.multi_cell(140, 5,
        "1-bit dithered mobile dashboard for monitoring AI agent sessions.\n"
        "Skins. Physics. Weather. Marketplace. Modules. Floyd-Steinberg everything.")

    stats_y = tag_y + 38
    p.stat_box(15, stats_y, 35, 22, "Tasks", "15")
    p.stat_box(53, stats_y, 35, 22, "Stages", "6", CYAN)
    p.stat_box(91, stats_y, 35, 22, "Skins", "6", GREEN)
    p.stat_box(129, stats_y, 35, 22, "Modules", "5", GREEN)
    p.stat_box(167, stats_y, 28, 22, "Risk", "HIGH", RED)

    p.set_xy(15, stats_y + 28)
    p.hdr("Tech Stack")
    for name, desc in [
        ("Tauri 2", "Native shell + WebView for Android/iOS"),
        ("Vite 6 + TS", "Build tooling + type safety"),
        ("Canvas API", "Pure canvas rendering, no framework"),
        ("Floyd-Steinberg", "1-bit dithering on everything"),
        ("WebSocket", "Real-time connection to host server"),
        ("DeviceMotion", "Accelerometer physics + weather"),
    ]:
        p.set_font(p.fn, "B", 9)
        p.set_text_color(*GREEN)
        p.cell(40, 5, f"  {name}")
        p.set_font(p.fn, "", 8)
        p.set_text_color(*DIM)
        p.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")

    p.footer_text("#0A55 // SeMmy + Claude Opus 4.6 // github.com/SeMmyT")

    # ========== PAGE 2: ARCHITECTURE ==========
    p.new_page()
    p.set_y(10)
    p.hdr("Architecture")
    next_y = p.place_img("noass-architecture-jeans.png", 20, p.get_y(), 170, margin_below=5)
    p.set_y(next_y)
    p.txt(
        "NOASS is a pure WebSocket client. The server stays on your machine, "
        "polling the agent runtime every 2 seconds and broadcasting JSON state. "
        "The mobile app connects via Tailscale or local network, renders everything "
        "on a single HTML Canvas with Floyd-Steinberg dithering, and sends commands back.")

    p.hdr("Protocol")
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*GREEN)
    p.cell(0, 5, "  Server -> Client (every 2s):", new_x="LMARGIN", new_y="NEXT")
    p.set_font(p.fn, "", 8)
    p.set_text_color(*WHITE)
    p.multi_cell(0, 4,
        '  { type: "state", panes: [{name, alive, ctx_k,\n'
        '    rate_k_per_min, eta_800k_min, ctx_pct, last}],\n'
        '    log: [...], stats: {...} }\n'
        '  { type: "readResult", target, content }\n'
        '  { type: "ack", command, target, success }')
    p.ln(3)
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*GREEN)
    p.cell(0, 5, "  Client -> Server:", new_x="LMARGIN", new_y="NEXT")
    p.set_font(p.fn, "", 8)
    p.set_text_color(*WHITE)
    p.multi_cell(0, 4,
        '  { type: "nudge"|"kill"|"read"|"revive",\n'
        '    target, message?, lines? }')
    p.ln(3)

    p.hdr("Key Invariants")
    p.bul("pane.name is the canonical stable identity key")
    p.bul("30fps target, 3-tier degradation on Android")
    p.bul("Settings uses DOM overlay for reliable keyboard")
    p.bul("Fonts bundled locally (no CDN dependency)")
    p.bul("Modules get ModuleContext, not raw AppState")
    p.footer_text("#0A55 // Architecture")

    # ========== PAGE 3: STAGED PLAN ==========
    p.new_page()
    next_y = p.place_img("noass-banner-jeans.png", 5, 5, 200, margin_below=5)
    p.set_y(next_y)
    p.hdr("Staged Plan")

    for title, desc, tasks in [
        ("STAGE 1: CORE", "Tauri 2 scaffold + Canvas renderer", "T01-T04"),
        ("STAGE 2: THEMING", "Skin system + settings UI", "T05-T06"),
        ("STAGE 3: MARKETPLACE", "Skin marketplace + navigation", "T07-T08"),
        ("STAGE 4: BUILD", "Android APK + iOS prep + polish", "T09-T12"),
        ("STAGE 5: PHYSICS", "Accelerometer + weather effects", "T13-T14"),
        ("STAGE 6: EEOAO", "Module system + gamification", "T15"),
    ]:
        y = p.get_y()
        p.panel(15, y, 180, 12)
        p.set_xy(17, y + 2)
        p.set_font(p.fn, "B", 9)
        p.set_text_color(*ACCENT)
        p.cell(50, 5, title)
        p.set_font(p.fn, "", 8)
        p.set_text_color(*WHITE)
        p.cell(90, 5, desc)
        p.set_text_color(*DIM)
        p.cell(25, 5, tasks, align="R")
        p.set_y(y + 14)

    p.ln(3)
    p.hdr("Task Breakdown")
    for num, name, status, risk in [
        (1, "Tauri 2 Project Scaffold", "READY", "LOW"),
        (2, "Port Canvas Renderer", "READY", "MED"),
        (3, "Port Graph, UI, Controls", "READY", "MED"),
        (4, "Main App Entry + WS Client", "READY", "MED"),
        (5, "Default Skins Bundle (6)", "READY", "LOW"),
        (6, "Settings Screen (DOM)", "READY", "LOW"),
        (7, "Marketplace Screen", "READY", "MED"),
        (8, "Navigation + Gestures", "READY", "MED"),
        (9, "Mock Data Mode (Demo)", "READY", "LOW"),
        (10, "Android Build Setup", "TODO", "HIGH"),
        (11, "iOS Project Prep", "TODO", "MED"),
        (12, "Polish & Ship", "TODO", "MED"),
        (13, "Accelerometer Physics", "TODO", "MED"),
        (14, "Weather Effects", "TODO", "MED"),
        (15, "EEOAO Module System", "TODO", "HIGH"),
    ]:
        p.task_row(num, name, status, risk)

    p.footer_text("#0A55 // Staged Plan")

    # ========== PAGE 5: SKINS ==========
    p.new_page()
    p.set_y(10)
    p.hdr("Skin System")
    next_y = p.place_img("noass-skins-preview-jeans.png", 30, p.get_y(), 150, margin_below=5)
    p.set_y(next_y)
    p.txt(
        "Every visual parameter is controlled by a Skin manifest: accent color, "
        "node grays, scanline opacity/gap, vignette strength, CRT curvature, "
        "pulse frequency, font family, connection style, weather type, "
        "and device gravity strength.")

    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  BUNDLED SKINS:", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for name, color, desc in [
        ("Matrix", "#00ff41", "Classic green phosphor terminal"),
        ("Amber CRT", "#ffb000", "Warm amber phosphor. 1983 IBM."),
        ("Ice", "#00d4ff", "Cold blue. Server room at 3AM."),
        ("Blood Moon", "#ff2222", "Red alert. Something is on fire."),
        ("Phantom", "#bb86fc", "Pale violet. Ghost in the machine."),
        ("Solar Flare", "#ff6600", "Orange nova. High energy."),
    ]:
        p.set_font(p.fn, "B", 9)
        p.set_text_color(*WHITE)
        p.cell(30, 5, f"  {name}")
        p.set_font(p.fn, "", 8)
        p.set_text_color(*DIM)
        p.cell(18, 5, color)
        p.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")

    p.ln(3)
    p.hdr("Physics & Weather")
    p.txt(
        "Accelerometer physics: tilt the phone, nodes slide with gravity. "
        "Shake to scatter. Normalized screen-space gravity with smoothing. "
        "2-second shake cooldown. iOS permission via settings toggle.")
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  WEATHER TYPES:", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for name, desc in [
        ("Rain", "Vertical white streaks, tilt-reactive"),
        ("Snow", "Slow drift, accumulates at bottom"),
        ("Static", "TV noise, density via skin"),
        ("Matrix", "Falling green chars, classic"),
        ("Sparks", "Float upward from alive nodes"),
    ]:
        p.set_font(p.fn, "B", 8)
        p.set_text_color(*CYAN)
        p.cell(18, 5, f"  {name}")
        p.set_font(p.fn, "", 8)
        p.set_text_color(*WHITE)
        p.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")

    p.footer_text("#0A55 // Skins & Physics")

    # ========== PAGE 6: MARKETPLACE + EEOAO ==========
    p.new_page()
    p.set_y(10)
    p.hdr("Marketplace")
    next_y = p.place_img("noass-marketplace-jeans.png", 70, p.get_y(), 50, margin_below=5)
    p.set_y(next_y)
    p.txt(
        "Browse, preview, and apply skins. Featured row + grid layout. "
        "Tap to live-preview (entire UI changes to show skin in action). "
        "Bundled catalog for MVP, remote catalog API later.")

    p.hdr("EEOAO: Module System")
    p.txt(
        "Everything Everywhere All at Once. Each project becomes a module "
        "inside #0A55. Modules get isolated ModuleContext (read-only host state, "
        "namespaced storage). Lifecycle: destroy -> init, no leaked side effects.")

    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  PLANNED MODULES:", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for name, desc in [
        ("Orchestra", "NeoOrchestra/Strudel live coding audio"),
        ("Voice", "ReVisper speech-to-text"),
        ("Ghost Hunt", "Dithered co-op game viewer"),
        ("HackRF", "Spectrum dashboard"),
        ("Crawler", "Web crawler status"),
    ]:
        p.set_font(p.fn, "B", 8)
        p.set_text_color(*GREEN)
        p.cell(22, 5, f"  {name}")
        p.set_font(p.fn, "", 8)
        p.set_text_color(*WHITE)
        p.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")

    p.ln(3)
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  ACHIEVEMENTS (unlock hidden modules):", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for name, cond in [
        ("First Blood", "Kill an agent from dashboard"),
        ("Night Owl", "Use app after midnight"),
        ("Context Lord", "Monitor 1M+ total context"),
        ("Skin Collector", "Apply 3 different skins"),
    ]:
        p.set_font(p.fn, "B", 8)
        p.set_text_color(*CYAN)
        p.cell(25, 5, f"  {name}")
        p.set_font(p.fn, "", 8)
        p.set_text_color(*DIM)
        p.cell(0, 5, cond, new_x="LMARGIN", new_y="NEXT")

    p.footer_text("#0A55 // Marketplace & EEOAO")

    # ========== PAGE 7: ARCHITECT REVIEW ==========
    p.new_page()
    p.set_y(10)
    p.hdr("Architect Review (GPT 5.4)")

    y = p.get_y()
    p.panel(15, y, 88, 18)
    p.set_xy(17, y + 2)
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*WHITE)
    p.cell(60, 5, "ROUND 1: Stages 1-4")
    p.set_xy(17, y + 8)
    p.set_font(p.fn, "", 8)
    p.set_text_color(*RED)
    p.cell(22, 5, "5 BLOCK")
    p.set_text_color(*ACCENT)
    p.cell(22, 5, "2 DEGRADE")
    p.set_text_color(*GREEN)
    p.cell(22, 5, "RESOLVED")

    p.panel(107, y, 88, 18)
    p.set_xy(109, y + 2)
    p.set_font(p.fn, "B", 9)
    p.set_text_color(*WHITE)
    p.cell(60, 5, "ROUND 2: Stages 5-6")
    p.set_xy(109, y + 8)
    p.set_font(p.fn, "", 8)
    p.set_text_color(*RED)
    p.cell(22, 5, "6 BLOCK")
    p.set_text_color(*ACCENT)
    p.cell(22, 5, "2 DEGRADE")
    p.set_text_color(*GREEN)
    p.cell(22, 5, "RESOLVED")

    p.set_y(y + 22)
    p.ln(2)

    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  ROUND 1 - BLOCKING RESOLVED:", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for t, f in [
        ("[INTERFACE] read flow missing response contract", "readResult/ack already in server.js, added to types"),
        ("[COUPLING] thin shell vs mobile-native", "All web APIs except back button (Tauri)"),
        ("[INVARIANT] node identity underspecified", "pane.name canonical, reconciliation explicit"),
        ("[RESOURCE] no performance budget", "30fps, 3-tier degradation"),
        ("[INTERFACE] settings canvas text input", "DOM overlay instead"),
    ]:
        p.issue_row(t, f)

    p.set_font(p.fn, "B", 9)
    p.set_text_color(*ACCENT)
    p.cell(0, 5, "  ROUND 2 - BLOCKING RESOLVED:", new_x="LMARGIN", new_y="NEXT")
    p.ln(1)
    for t, f in [
        ("[TEMPORAL] iOS motion permission", "Settings toggle calls requestPermission on tap"),
        ("[INVARIANT] gravity vector unnormalized", "Screen-space mapping, clamp [-1,1], smoothing"),
        ("[RESOURCE] degradation only covers particles", "Extended: weather->physics->dither->vignette"),
        ("[INTERFACE] module IDs unconstrained", "Regex /^[a-z][a-z0-9-]{1,30}$/, reject reserved"),
        ("[TEMPORAL] module lifecycle unordered", "destroy() before init(), onDestroy() hooks"),
        ("[INTERFACE] shared AppState unconstrained", "ModuleContext: read-only host, namespaced store"),
    ]:
        p.issue_row(t, f)

    p.ln(2)
    p.hdr("Survivability")
    p.txt(
        "15 tasks across 6 stages. All 11 blocking critiques resolved. "
        "Highest risk: Task 10 (Android SDK on WSL2) and Task 15 "
        "(first real module port tests the isolation contract). "
        "Physics/weather need real-device accelerometer testing. "
        "Plan survives contact with the codebase.")

    p.footer_text("#0A55 // Co-Authored-By: Claude Opus 4.6 // Guided-By: SeMmy")

    p.output(OUT)
    sz = os.path.getsize(OUT)
    print(f"PDF saved: {OUT} ({sz:,} bytes, {sz/1024/1024:.1f}MB)")


if __name__ == "__main__":
    build()
