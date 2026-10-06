// Зоны нажатия на 390 px: все видимые интерактивные элементы не меньше 40 px по высоте (этап 13).
const path = require("path");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
const useFontCache = require("./fontcache");
const ROOT = path.resolve(__dirname, "..");
(async () => {
  const b = await chromium.launch();
  const small = new Map();
  for (const ver of ["v1-panel", "v3-path", "v2-registry"]) for (const v of ["summary", "gantt", "focus", "board", "milestones"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await useFontCache(ctx);
    const p = await ctx.newPage();
    await p.goto(`file://${ROOT}/versions/${ver}.html?view=${v}&today=2026-10-06`, { waitUntil: "load" });
    await p.waitForTimeout(300);
    if (v === "focus") { await p.click('[data-k="f-2.1.7"]'); await p.click('[data-k="st-Закрыто"]'); }
    if (v === "board") { await p.evaluate(() => { try { localStorage.setItem("orbita.ymg-iim.s1.edits.v1", JSON.stringify({ "2.1.7": { status: "Закрыто" }, "2.1.5": { comment: "Ответ до 02.10" } })); } catch (e) {} }); await p.reload(); await p.click('[data-k="marks"]'); }
    const r = await p.evaluate(() => [...document.querySelectorAll("button, a, select, input, textarea, summary, [tabindex='0']")]
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== "hidden")
      .map((e) => { const b = e.getBoundingClientRect(); return [e.dataset.k || e.className || e.tagName, Math.round(b.height), Math.round(b.width)]; })
      .filter(([, h, w]) => h < 40 && w > 0));
    r.forEach(([k, h, w]) => small.set(`${v}: ${k}`, `${w}×${h}`));
    await ctx.close();
  }
  await b.close();
  console.log(small.size ? [...small].map(([k, v]) => `${k} ${v}`).join("\n") : "Все зоны нажатия ≥ 40 px");
})();
