// Модульные тесты правил расчёта (src/engine.js) без браузера. Запуск: node tests/engine.test.js
// Эталонные значения — данные План-графика на дату редакции 28.09.2026 (SPEC §4, DECISIONS Р-15…Р-47, Р-61).
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const E = require(path.join(ROOT, "src/engine.js"));
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "src/config.js"), "utf8") + "\nthis.CONFIG = CONFIG;", ctx);
const C = ctx.CONFIG;
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, "data/seed_ymg_stage1.json"), "utf8"));
const T0 = E.dn("2026-09-28");

const results = [];
const test = (name, fn) => { try { fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); } };

// ── Календарь [Р-04, Р-25, Р-65]
test("Календарь: выходные, 04.11.2026, 31.12.2026 и 01–08.01.2027 — нерабочие", () => {
  const cal = E.calendar(C.HOLIDAYS);
  for (const d of ["2026-10-03", "2026-10-04", "2026-11-04", "2026-12-31", "2027-01-01", "2027-01-05", "2027-01-08", "2027-01-09"]) assert.strictEqual(cal.isWork(E.dn(d)), false, d);
  for (const d of ["2026-09-28", "2026-11-05", "2026-12-30", "2027-01-11"]) assert.strictEqual(cal.isWork(E.dn(d)), true, d);
});
test("Календарь: рабочие дни в интервале (a; b] со знаком", () => {
  const cal = E.calendar(C.HOLIDAYS);
  assert.strictEqual(cal.wd(E.dn("2026-11-16"), E.dn("2026-11-27")), 9); // окно приёмки П-17
  assert.strictEqual(cal.wd(E.dn("2026-11-27"), E.dn("2026-11-16")), -9);
  assert.strictEqual(cal.wd(E.dn("2026-12-30"), E.dn("2027-01-11")), 1); // только 11.01
  assert.strictEqual(cal.shift(E.dn("2026-12-30"), 1), E.dn("2027-01-11"));
});

// ── Модель на дату редакции
const M = E.build(SEED, C, {}, T0);
test("Состав: 66 работ, 47 обязательств перед Заказчиком, 4 раздела", () => {
  assert.strictEqual(M.work.length, 66);
  assert.strictEqual(M.base.length, 47);
  assert.strictEqual(M.sections.reduce((a, s) => a + s.total, 0), 47);
});
test("Показатели на 28.09.2026: выполнено 10, просрочено 2, план на сегодня 8 из 10", () => {
  assert.strictEqual(M.kpi.closed, 10);
  assert.strictEqual(M.kpi.overdue, 2);
  assert.strictEqual(M.kpi.reached, 10);
  assert.strictEqual(M.kpi.reachedClosed, 8);
  assert.strictEqual(M.kpi.pct, 21);
  assert.strictEqual(M.kpi.toDemoWd, 44);
});
test("Периоды «Ближайших сроков»: 8 / 9 / 3 / 23 / 13 / 10", () => {
  const n = (h) => M.work.filter((i) => i.horizon === h).length;
  assert.deepStrictEqual(["overdue", "h14", "h30", "h60", "later", "closed"].map(n), [8, 9, 3, 23, 13, 10]);
});
test("Статус подпозиции без отметки наследуется от группы [Р-15]", () => {
  const i = M.by["2.1.1.2"];
  assert.strictEqual(i.src, "inherited");
  assert.strictEqual(i.inheritedFrom, "2.1.1");
  assert.strictEqual(i.status, M.by["2.1.1"].status);
});
test("Путь к демонстрации: 8 шагов, резерв расходуется, 2 из 11 рабочих дней, срыв с 01.10.2026 [Р-47]", () => {
  assert.strictEqual(M.chainNums.length, 8);
  assert.strictEqual(M.chainState, "eroding");
  const w = M.chainWindows[0];
  assert.strictEqual(w.from, "2.1.7"); assert.strictEqual(w.to, "2.1.6");
  assert.strictEqual(w.P, 11); assert.strictEqual(w.R, 2);
  assert.strictEqual(w.breachFrom, E.dn("2026-10-01"));
  assert.strictEqual(M.chainWindows.filter((x) => x.state === "overlap").length, 2); // С-3
});
test("Повестка: 4 просрочено, 2 контрольная дата, 2 срок в 14 дней [Р-50, Р-62]", () => {
  assert.deepStrictEqual(E.agenda(M).counts, [4, 2, 2]);
  assert.ok(/\(п\. 2\.1\.7\)/.test(E.agenda(M).text));
});

// ── Правки и другие даты
test("Закрытие «Закупки материалов» с документом: выполнено 11, просрочено 1", () => {
  const M2 = E.build(SEED, C, { "2.1.7": { status: "Закрыто", closeDoc: { name: "Документ", letter: "", date: "2026-09-28" } } }, T0);
  assert.strictEqual(M2.kpi.closed, 11);
  assert.strictEqual(M2.kpi.overdue, 1);
  assert.strictEqual(M2.by["2.1.7"].noReq, false);
});
test("Закрытие без реквизита отмечается «без документа» [Р-31]", () => {
  const M2 = E.build(SEED, C, { "2.1.5": { status: "Закрыто", closeDoc: { name: "", letter: "", date: "2026-09-28" } } }, T0);
  assert.strictEqual(M2.by["2.1.5"].noReq, true);
});
test("На 01.03.2027 просрочено 37 из 47, путь — угроза срыва", () => {
  const M3 = E.build(SEED, C, {}, E.dn("2027-03-01"));
  assert.strictEqual(M3.kpi.overdue, 37);
  assert.strictEqual(M3.chainState, "breach");
});
test("Исходные данные не изменяются расчётом", () => {
  const before = JSON.stringify(SEED);
  E.build(SEED, C, { "2.1.7": { status: "Закрыто" } }, T0);
  assert.strictEqual(JSON.stringify(SEED), before);
});
test("Краткие наименования есть у всех 71 позиции и не пусты [Р-55]", () => {
  const nums = SEED.items.map((i) => i.num);
  assert.strictEqual(nums.length, 71);
  nums.forEach((n) => assert.ok(C.SHORT[n] && C.SHORT[n].trim(), n));
});

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
results.forEach(([r, n, e]) => console.log(`${r}  ${pad(n, 96)} ${e || ""}`));
const fails = results.filter((r) => r[0] === "FAIL").length;
console.log(`\nИтого: ${results.length - fails} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
