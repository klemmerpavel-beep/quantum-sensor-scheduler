const path = require("path"), fs = require("fs");
const ROOT = path.resolve(__dirname, "..");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
// Аудит доступности axe-core (WCAG 2.2 AA + best-practice) по пяти режимам В1 в обеих темах.
// Запуск: AXE=/путь/к/axe-core/axe.min.js node tests/a11y.js (axe-core: npm install axe-core@4).
// Принятое исключение (Р-64): target-size у столбиков дат «Вех» — равноценный выбор даты списком «Выбрать дату».
const AXE = fs.readFileSync(process.env.AXE || process.argv[2], "utf8");
const ACCEPTED = new Set(["target-size"]);
(async () => {
  const b = await chromium.launch(); const agg = new Map();
  for (const th of ["light", "dark"]) for (const v of ["summary", "gantt", "focus", "board", "milestones"]) for (const extra of ["", "open"]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    // «Статусы» + open: окно «Отметки в этом браузере» в состоянии подтверждения сброса (Р-71)
    const marks = v === "board" && extra === "open";
    if (marks) await p.addInitScript(() => { try { localStorage.setItem("orbita.ymg-iim.s1.edits.v1", JSON.stringify({ "2.1.7": { status: "Закрыто", closeDoc: { name: "Акт", letter: "", date: "2026-09-28" } }, "2.1.5": { comment: "Ответ до 02.10" } })); } catch (e) {} });
    await p.goto(`file://${ROOT}/versions/v1-panel.html?view=${v}&today=2026-10-06&theme=${th}`); await p.waitForTimeout(300);
    if (marks) { await p.click('[data-k="marks"]'); await p.click('[data-k="mk-reset"]'); }
    else if (extra === "open") { await p.locator("[data-open]:visible").first().click(); if (v === "focus") { await p.keyboard.press("Escape"); await p.click('[data-k="agenda"]'); } }
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] })).violations.map((x) => [x.id, x.impact, x.nodes.length, x.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n")[1]).join(" || ")]));
    r.forEach(([id, imp, n, ex]) => { const k = id; const e = agg.get(k) || { imp, n: 0, where: new Set(), ex }; e.n += n; e.where.add(`${th}/${v}${extra ? "+" + extra : ""}`); agg.set(k, e); });
    await p.close();
  }
  await b.close();
  [...agg.keys()].forEach((k) => { if (ACCEPTED.has(k) && [...agg.get(k).where].every((w) => w.includes("milestones"))) { console.log(`принято (Р-64): ${k} — ${agg.get(k).n} столбиков дат «Вех»`); agg.delete(k); } });
  if (!agg.size) console.log("axe: нарушений нет");
  process.exitCode = agg.size ? 1 : 0;
  agg.forEach((e, k) => console.log(`${k} [${e.imp}] ×${e.n} в ${[...e.where].slice(0, 6).join(", ")}${e.where.size > 6 ? "…" : ""}\n   ${e.ex}`));
})();

