// Поиск латиницы в видимом тексте и подписях доступности (критерий приёмки 6).
const path = require("path");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
const useFontCache = require("./fontcache");
const ROOT = path.resolve(__dirname, "..");
(async () => {
  const b = await chromium.launch();
  const found = new Set();
  for (const ver of ["v1-panel", "v2-registry", "v3-path"]) for (const v of ["summary", "gantt", "focus", "board", "milestones"]) for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, locale: "en-US" });
    await useFontCache(ctx);
    const p = await ctx.newPage();
    await p.goto(`file://${ROOT}/versions/${ver}.html?view=${v}&today=2026-09-28`, { waitUntil: "load" });
    await p.waitForTimeout(300);
    if (v === "focus" && w === 1440) { await p.click('[data-k="f-2.1.7"]'); await p.click('[data-k="st-Закрыто"]'); }
    const txt = await p.evaluate(() => {
      const parts = [document.body.innerText, document.title];
      document.querySelectorAll("[aria-label],[title],[placeholder],[alt]").forEach((e) => ["aria-label", "title", "placeholder", "alt"].forEach((a) => e.getAttribute(a) && parts.push(e.getAttribute(a))));
      return parts.join("\n");
    });
    (txt.match(/[A-Za-z][A-Za-z0-9]+/g) || []).forEach((m) => found.add(m));
    await ctx.close();
  }
  await b.close();
  console.log(found.size ? "Латиница: " + [...found].join(", ") : "Латиница в интерфейсе не найдена");
})();
