// Снимки режимов и проверка консоли (этап 16). Запуск: node tests/shots.js
const path = require("path");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
const ROOT = path.resolve(__dirname, "..");
const useFontCache = require("./fontcache");
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const VIEWS = ["summary", "gantt", "focus", "board", "milestones"];
const SIZES = [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]];
(async () => {
  const browser = await chromium.launch({ proxy });
  const errors = [];
  const shots = [];
  const plan = [];
  // В1 — все режимы × 2 ширины × 2 темы = 20 снимков
  for (const v of VIEWS) for (const [sz] of SIZES) for (const th of ["light", "dark"]) plan.push(["v1-panel", v, sz, th]);
  // В2, В3 — первый экран × 2 ширины × 2 темы
  for (const [ver, v] of [["v2-registry", "gantt"], ["v3-path", "summary"]]) for (const [sz] of SIZES) for (const th of ["light", "dark"]) plan.push([ver, v, sz, th]);
  for (const [ver, v, sz, th] of plan) {
    const ctx = await browser.newContext({ viewport: Object.fromEntries(SIZES)[sz], ignoreHTTPSErrors: true });
    await useFontCache(ctx);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${ver} ${v} ${sz} ${th}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${ver} ${v} ${sz} ${th}: PAGEERROR ${e.message}`));
    const url = `file://${ROOT}/versions/${ver}.html?view=${v}&today=2026-09-28&theme=${th}`;
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(600);
    const f = `screenshots/${ver}_${v}_${sz}_${th}.png`;
    await page.screenshot({ path: path.join(ROOT, f), fullPage: false });
    shots.push(f);
    await ctx.close();
  }
  await browser.close();
  console.log("shots:", shots.length);
  console.log(errors.length ? errors.join("\n") : "console: no errors");
})();
