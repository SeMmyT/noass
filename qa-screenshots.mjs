import { chromium } from 'playwright';

const DESK = '/mnt/c/Users/Daniel/Desktop';
const BASE = 'http://localhost:1420/';

const SCENARIOS = [
  { name: 'demo-default', url: '?demo=1', wait: 4000 },
  { name: 'matrix-ice', url: '?demo=1&weather=matrix&skin=ice', wait: 4000 },
  { name: 'rain-amber', url: '?demo=1&weather=rain&skin=amber', wait: 4000 },
  { name: 'sparks-blood', url: '?demo=1&weather=sparks&skin=blood', wait: 4000 },
  { name: 'snow-phantom', url: '?demo=1&weather=snow&skin=phantom', wait: 4000 },
  { name: 'solar-static', url: '?demo=1&weather=static&skin=solar', wait: 4000 },
];

const browser = await chromium.launch();

// Dashboard screenshots — all 6 skins
for (const s of SCENARIOS) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + s.url);
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `${DESK}/QA-${s.name}.png` });
  await ctx.close();
  console.log(`  ${s.name}`);
}

// Settings + Marketplace screenshots
const ctx = await browser.newContext({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE + '?demo=1');
await page.waitForTimeout(3000);

// Settings
await page.keyboard.press('s');
await page.waitForTimeout(800);
await page.screenshot({ path: `${DESK}/QA-settings.png` });

// Close settings, open marketplace
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('m');
await page.waitForTimeout(800);
await page.screenshot({ path: `${DESK}/QA-marketplace.png` });

await ctx.close();
console.log('  settings + marketplace');

await browser.close();
console.log('\nAll QA screenshots on Desktop');
