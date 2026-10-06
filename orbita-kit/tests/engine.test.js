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

test("Календарь: быстрый подсчёт совпадает с перебором дней на 2020–2036 годах [Р-72]", () => {
  const cal = E.calendar(C.HOLIDAYS);
  const slow = (a, b) => { let c = 0; const lo = Math.min(a, b), hi = Math.max(a, b); for (let x = lo + 1; x <= hi; x++) if (cal.isWork(x)) c++; return a < b ? c : a === b ? 0 : -c; };
  const pts = ["2019-12-31", "2020-01-01", "2026-09-28", "2026-12-31", "2027-01-11", "2035-12-31", "2036-06-01"].map(E.dn);
  for (const a of pts) for (const b of pts) assert.strictEqual(cal.wd(a, b), slow(a, b), `${E.iso(a)} → ${E.iso(b)}`);
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
  assert.deepStrictEqual(E.agenda(M).sections.map((x) => x.key), ["overdue", "ctrl", "soon"]);
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
test("На 01.03.2027 срок прошёл у 37 из 47: просрочено 2, без подтверждения 35; путь — угроза срыва [Р-74]", () => {
  const M3 = E.build(SEED, C, {}, E.dn("2027-03-01"));
  assert.strictEqual(M3.kpi.overdue, 2);
  assert.strictEqual(M3.kpi.overdue + M3.kpi.unconf, 37);
  assert.strictEqual(M3.chainState, "breach");
});
test("После даты отметок (06.10.2026): просрочено 2, срок прошёл без подтверждения 6; отметка пользователя подтверждает [Р-74]", () => {
  const T6 = E.dn("2026-10-06"), M6 = E.build(SEED, C, {}, T6);
  assert.strictEqual(M6.kpi.overdue, 2);
  assert.strictEqual(M6.kpi.unconf, 6);
  assert.deepStrictEqual(M6.base.filter((i) => i.overdue).map((i) => i.num), ["2.1.5", "2.1.7"]);
  assert.strictEqual(M6.by["2.1.6"].unconf, true);
  assert.strictEqual(M6.by["2.1.6"].horizon, "overdue");
  const a = E.agenda(M6);
  assert.deepStrictEqual(a.sections.map((x) => x.head.split(" ")[0] + x.list.length), ["I.4", "II.4", "III.0", "IV.2"]);
  assert.ok(/II\. Срок прошёл после 28\.09\.2026 — подтвердить выполнение\n1\. /.test(a.text));
  const M7 = E.build(SEED, C, { "2.1.6": { status: "На согласовании" } }, T6);
  assert.strictEqual(M7.by["2.1.6"].unconf, false);
  assert.strictEqual(M7.by["2.1.6"].overdue, true);
  // на дату редакции признак не возникает
  assert.strictEqual(M.work.filter((i) => i.unconf).length, 0);
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

test("Проверка отметок из хранилища: чужие работы, неизвестные статусы и HTML отбрасываются [Р-70]", () => {
  const r = E.sanitizeEdits(SEED, {
    "2.1.7": { status: "Закрыто", closeDoc: { name: "Акт", letter: 12, date: "2026-09-28" }, comment: "  " },
    "9.9.9": { status: "В работе" },
    "2.1.6": { status: "<img src=x onerror=alert(1)>" },
    "1": { status: "Закрыто" },
    "2.1.5": { comment: "x".repeat(3000) },
  });
  assert.deepStrictEqual(Object.keys(r.edits).sort(), ["2.1.5", "2.1.7"]);
  assert.deepStrictEqual(r.edits["2.1.7"].closeDoc, { name: "Акт", letter: "", date: "2026-09-28" });
  assert.strictEqual(r.edits["2.1.5"].comment.length, 2000);
  assert.deepStrictEqual(r.dropped.sort(), ["1", "2.1.6", "9.9.9"]);
  assert.deepStrictEqual(E.sanitizeEdits(SEED, [1, 2]).dropped, ["*"]);
  assert.deepStrictEqual(E.sanitizeEdits(SEED, null), { edits: {}, dropped: [] });
});

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
results.forEach(([r, n, e]) => console.log(`${r}  ${pad(n, 96)} ${e || ""}`));
const fails = results.filter((r) => r[0] === "FAIL").length;
console.log(`\nИтого: ${results.length - fails} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
