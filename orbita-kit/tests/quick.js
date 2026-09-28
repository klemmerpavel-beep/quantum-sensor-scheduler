// Быстрый снимок для итераций: node tests/quick.js <версия> <view> <ширина> <тема> [доп. параметры]
const path = require("path");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
const ROOT = path.resolve(__dirname, "..");
const useFontCache = require("./fontcache");
const [ver = "v1-panel", view = "summary", w = "1440", th = "light", extra = ""] = process.argv.slice(2);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const OUT = process.env.QUICK_OUT || "/tmp/claude-0/-home-user-quantum-sensor-scheduler/4745f20a-163f-5a6d-b475-943f641a365a/scratchpad";
(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ viewport: { width: +w, height: w === "390" ? 844 : 900 }, ignoreHTTPSErrors: true });
  await useFontCache(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(`file://${ROOT}/versions/${ver}.html?view=${view}&today=2026-09-28&theme=${th}${extra}`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const out = `${OUT}/q_${ver}_${view}_${w}_${th}.png`;
  await p.screenshot({ path: out });
  const rows = await p.evaluate(() => {
    const w = document.querySelector(".gwrap"); if (!w || !w.offsetParent) return null;
    const r = w.getBoundingClientRect();
    return [...w.querySelectorAll("tbody tr")].filter((t) => { const b = t.getBoundingClientRect(); return b.bottom <= Math.min(r.bottom, innerHeight) + 1 && b.top >= r.top; }).length;
  });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const pageH = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log(out, "errors:", errs.length ? errs : "none", "| gantt rows fully visible:", rows, "| hscroll:", overflow, "| page height:", pageH);
  await b.close();
})();
