// Поведенческие и стресс-тесты (этапы 15–17). Запуск: node tests/behaviour.js
// Каждый сценарий: проверки + снимок в screenshots/stress/. Консоль страницы должна быть без ошибок.
const fs = require("fs"), path = require("path");
const { chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
const useFontCache = require("./fontcache");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "screenshots/stress");
fs.mkdirSync(OUT, { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const results = [];
const ok = (name, cond, info = "") => { results.push([cond ? "PASS" : "FAIL", name, info]); };

// Стресс-копия страницы: изменённые данные только в тестовом файле (SEED в продукте не меняется).
function stressPage() {
  const html = fs.readFileSync(path.join(ROOT, "versions/v1-panel.html"), "utf8");
  const m = html.match(/window\.SEED = (\{.*?\});\n<\/script>/s);
  const seed = JSON.parse(m[1]);
  const long = "Проверка предельной длины наименования позиции План-графика: ".padEnd(500, "длинное наименование работ, мероприятий ");
  seed.items.find((i) => i.num === "2.1.3").name = long.slice(0, 500);
  seed.items.find((i) => i.num === "3.5").owners = ["Электроприбор", "ФТИ им. Иоффе", "ИХС им. Гребенщикова"];
  const f = path.join(OUT, "_stress.html");
  fs.writeFileSync(f, html.replace(m[1], JSON.stringify(seed)));
  return f;
}

(async () => {
  const b = await chromium.launch({ proxy });
  async function open(file, query, opts = {}) {
    const ctx = await b.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    await useFontCache(ctx);
    if (opts.init) await ctx.addInitScript(opts.init);
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await page.goto(`file://${file}?${query}`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    return { ctx, page, errs };
  }
  const V1 = path.join(ROOT, "versions/v1-panel.html");
  const kpi = (page, id) => page.$eval(`[data-k="kpi-${id}"] .val`, (e) => e.textContent.trim());

  // 1. Закрытие позиции отражается во всех режимах и KPI (критерий 3)
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28");
    const before = await kpi(page, "overdue");
    await page.click('[data-k="r-2.1.7"]');
    await page.click('[data-k="st-Закрыто"]');
    const twoClicks = await page.isVisible('[data-k="cf-do"]');
    await page.click('[data-k="cf-do"]');
    await page.click('[data-k="p-close"]');
    const after = await kpi(page, "overdue");
    const closed = await kpi(page, "closed");
    const chain = await page.$eval(".pnotes", (e) => e.textContent.trim());
    await page.screenshot({ path: path.join(OUT, "01_close_2.1.7_summary.png") });
    ok("Закрытие: форма реквизита на 2-м нажатии", twoClicks);
    ok("Закрытие 2.1.7: KPI «Просрочено» 2 → 1", before === "2" && after === "1", `${before} → ${after}`);
    ok("Закрытие 2.1.7: KPI «Выполнено» 11 из 47", closed.startsWith("11"), closed);
    ok("Закрытие 2.1.7: окно цепочки пересчитано (угроза срыва снята, остаток 2 из 11)", chain.includes("осталось 2 из 11") && !chain.includes("срыв с"), chain);
    await page.click('[data-k="tab-board"]');
    const inClosedCol = await page.$$eval('.col[aria-label^="Закрыто"] [data-k="b-2.1.7"]', (els) => els.length === 1);
    ok("Закрытие 2.1.7: карточка в колонке «Закрыто» доски", inClosedCol);
    await page.click('[data-k="tab-gantt"]');
    const badge = await page.$eval('tr[data-open="2.1.7"] .st', (e) => e.textContent);
    ok("Закрытие 2.1.7: статус в «Графике работ»", badge.includes("Закрыто"), badge);
    await page.click('[data-k="tab-focus"]');
    const inOverdue = await page.$$eval('details.lane.overdue [data-k="f-2.1.7"]', (els) => els.length > 0);
    ok("Закрытие 2.1.7: ушла из горизонта «Просрочено»", !inOverdue);
    // без реквизита
    await page.click('[data-k="f-2.1.5"]');
    await page.click('[data-k="st-Закрыто"]');
    await page.fill('[data-k="cf-name"]', "");
    const warn = await page.isVisible(".warnbox");
    const btn = await page.$eval('[data-k="cf-do"]', (e) => e.textContent.trim());
    await page.click('[data-k="cf-do"]');
    const mark = await page.$eval(".pstat .st", (e) => e.textContent);
    ok("Закрытие без документа: предупреждение и пометка", warn && btn === "Закрыть без документа" && mark.includes("без документа"), mark);
    await page.screenshot({ path: path.join(OUT, "02_close_without_requisite_panel.png") });
    // повестка
    await page.keyboard.press("Escape");
    await page.click('[data-k="agenda"]');
    const talk = await page.$eval("#ag-text", (e) => e.value);
    ok("Повестка «для обсуждения»: вопросы к Исполнителю, наименования без номеров", talk.includes("Вопросы к Исполнителю") && !/\(п\. \d/.test(talk) && !/\b\d\.\d\.\d/.test(talk.replace(/\d{2}\.\d{2}\.\d{4}/g, "")), talk.split("\n").slice(3, 5).join(" | "));
    await page.click('[data-k="ag-letter"]');
    const agenda = await page.$eval("#ag-text", (e) => e.value);
    ok("Повестка «для письма»: формат «Наименование — комментарий (п. N)»", /— .+ \(п\. 2\.1\.\d\)/.test(agenda) && agenda.startsWith("Повестка оперативки"));
    await page.screenshot({ path: path.join(OUT, "03_agenda.png") });
    await page.keyboard.press("Escape");
    ok("Сценарий 1: консоль без ошибок", !errs.length, errs.join("; "));
    await ctx.close();
  }

  // 2. Клавиатура: переключатель режимов, фокус, Esc
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28");
    await page.keyboard.press("Tab"); // ссылка «Перейти к содержанию»
    await page.keyboard.press("Tab");
    const focusedTab = await page.evaluate(() => document.activeElement.getAttribute("role"));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const view = await page.evaluate(() => new URL(location.href).searchParams.get("view"));
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + " " + getComputedStyle(document.activeElement).outlineWidth);
    ok("Клавиатура: Tab → вкладка, → и Enter переключают режим", focusedTab === "tab" && view === "gantt", `${focusedTab}, ${view}`);
    ok("Клавиатура: видимый фокус 2 px", outline.includes("solid") && outline.includes("2px"), outline);
    await page.focus('tr[data-open="1.1"]');
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const panelOpen = await page.isVisible(".panel:not([hidden])");
    await page.keyboard.press("Escape");
    const panelClosed = !(await page.isVisible(".panel:not([hidden])"));
    ok("Клавиатура: строка «Ганта» — Enter открывает панель, Esc закрывает", panelOpen && panelClosed);
    ok("Сценарий 2: консоль без ошибок", !errs.length, errs.join("; "));
    await ctx.close();
  }

  // 3. Все позиции просрочены: ?today=2027-03-01
  {
    const { ctx, page, errs } = await open(V1, "today=2027-03-01");
    const od = await kpi(page, "overdue");
    await page.screenshot({ path: path.join(OUT, "04_today_2027-03-01_summary.png") });
    await page.click('[data-k="tab-gantt"]');
    await page.screenshot({ path: path.join(OUT, "05_today_2027-03-01_gantt.png") });
    ok("?today=2027-03-01: просрочено 37 из 47, отрисовка без ошибок", od === "37" && !errs.length, `${od}; ${errs.join("; ")}`);
    await ctx.close();
  }

  // 4. Все позиции закрыты (через правки) — пустое состояние «Топ-5»
  {
    const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "data/seed_ymg_stage1.json"), "utf8"));
    const edits = {};
    seed.items.filter((i) => i.kind !== "section").forEach((i) => { edits[i.num] = { status: "Закрыто", closeDoc: { name: "Документ", letter: "", date: "2026-09-28" } }; });
    const init = `try{localStorage.setItem("orbita.ymg-iim.s1.edits.v1", ${JSON.stringify(JSON.stringify(edits))});}catch(e){}`;
    const { ctx, page, errs } = await open(V1, "today=2026-09-28", { init });
    const txt = await page.textContent("#h-r + *");
    const closed = await kpi(page, "closed");
    await page.screenshot({ path: path.join(OUT, "06_all_closed_summary.png") });
    ok("Все выполнены: «Рисков нет: все работы выполнены», 47 из 47", txt.includes("Рисков нет: все работы выполнены") && closed.startsWith("47"), closed);
    ok("Сценарий 4: консоль без ошибок", !errs.length, errs.join("; "));
    await ctx.close();
  }

  // 5. localStorage недоступен
  {
    const init = `Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });`;
    const { ctx, page, errs } = await open(V1, "today=2026-09-28", { init });
    const foot = await page.textContent("footer.foot");
    await page.click('[data-k="r-2.1.7"]');
    await page.click('[data-k="st-В работе"]');
    const st = await page.$eval(".pstat .st", (e) => e.textContent);
    await page.screenshot({ path: path.join(OUT, "07_no_localstorage.png") });
    ok("Без localStorage: страница работает, правка применяется, есть уведомление", foot.includes("Отметки хранятся только до перезагрузки страницы") && st.includes("В работе") && !errs.length, errs.join("; "));
    await ctx.close();
  }

  // 6. Параметры ссылки: exec, org, неверные значения
  {
    let { ctx, page, errs } = await open(V1, "view=exec&today=2026-09-28");
    await page.click('[data-k="r-2.1.7"]');
    const noEdit = !(await page.$(".stseg")) && !(await page.$("textarea[data-comment]"));
    ok("?view=exec: сводка без элементов правки", noEdit && !errs.length);
    await ctx.close();
    ({ ctx, page, errs } = await open(V1, "org=fti&today=2026-09-28"));
    const tabs = await page.$$eval('[role="tab"]', (e) => e.map((x) => x.textContent));
    const rows = await page.$$eval("button.frow", (e) => e.map((x) => x.dataset.k.slice(2)));
    await page.screenshot({ path: path.join(OUT, "08_org_fti_focus.png") });
    ok("?org=fti: без «Сводки», только 2.1.6 и 2.2.1", !tabs.includes("Сводка") && rows.sort().join(",") === "2.1.6,2.2.1" && !errs.length, rows.join(","));
    await ctx.close();
    ({ ctx, page, errs } = await open(V1, "today=2026-13-45&view=abc&org=xyz"));
    const alerts = await page.$$eval(".banner.warn", (e) => e.length);
    ok("Неверные параметры: три сообщения, страница работает", alerts === 3 && !errs.length, `${alerts}`);
    await ctx.close();
    ({ ctx, page, errs } = await open(V1, "today=2026-09-28&theme=dark&view=milestones"));
    const th = await page.evaluate(() => document.documentElement.dataset.theme);
    ok("?theme=dark и ?view=milestones применяются", th === "dark" && (await page.isVisible(".ms-canvas")) && !errs.length);
    await ctx.close();
  }

  // 7. Стресс-данные: наименование 500 символов, три исполнителя, 10 позиций на 27.11
  {
    const f = stressPage();
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const { ctx, page, errs } = await open(f, "today=2026-09-28&view=board", { viewport: { width: w, height: h } });
      const hs = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await page.screenshot({ path: path.join(OUT, `09_stress_board_${w}.png`) });
      await page.click('[data-k="tab-gantt"]');
      await page.screenshot({ path: path.join(OUT, `10_stress_gantt_${w}.png`) });
      await page.click('[data-k="tab-milestones"]');
      await page.click('[data-k="ms-' + Math.round(Date.UTC(2026, 10, 27) / 864e5) + '"]').catch(() => {});
      await page.screenshot({ path: path.join(OUT, `11_stress_milestones_${w}.png`), fullPage: w === 1440 });
      await page.click('[data-k="tab-focus"]');
      await page.click('[data-k="f-2.1.3"]');
      const title = await page.$eval("#p-title", (e) => e.scrollWidth <= e.clientWidth + 1);
      await page.screenshot({ path: path.join(OUT, `12_stress_panel_500chars_${w}.png`) });
      ok(`Стресс ${w}px: нет горизонтальной прокрутки страницы, заголовок 500 симв. переносится`, !hs && title && !errs.length, errs.join("; "));
      await ctx.close();
    }
    fs.unlinkSync(f);
  }

  // 8. Фильтр без результатов
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28&view=gantt");
    await page.fill('[data-k="f-search"]', "нет такой позиции");
    const empty = await page.textContent(".gwrap");
    await page.screenshot({ path: path.join(OUT, "13_empty_filter.png") });
    ok("Фильтр без результатов: причина и следующий шаг", empty.includes("Нет работ, соответствующих условиям") && !errs.length);
    await ctx.close();
  }

  // 9. Роли: Исполнитель отвечает и за работы соисполнителей (Р-61)
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28&view=focus");
    await page.selectOption('[data-k="f-owner"]', "ep");
    const hasIhs = await page.$$eval('[data-k="f-2.2.2"]', (e) => e.length === 1);
    await page.click('[data-k="f-2.2.2"]');
    const resp = await page.textContent(".panel");
    ok("Роли: работа ИХС входит в обязательства Электроприбора; соисполнитель — через Исполнителя", hasIhs && resp.includes("Электроприбор» (Исполнитель)") && resp.includes("по договору с Электроприбором") && !errs.length, errs.join("; "));
    await ctx.close();
  }

  // 11. Справка «Как читать страницу» и метка пути (Р-65)
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28");
    const pill = await page.$eval("#h-ch", (e) => e.textContent);
    await page.click('[data-k="help"]');
    const txt = await page.textContent(".modal.help");
    const focusIn = await page.evaluate(() => !!document.activeElement.closest(".modal.help"));
    await page.keyboard.press("Escape");
    const closed = !(await page.$(".modal.help"));
    const back = await page.evaluate(() => document.activeElement.dataset.k);
    ok("Справка: роли, статусы, путь; фокус внутри, Esc закрывает и возвращает фокус; метка «1 шаг просрочен»", txt.includes("требования к ним предъявляются через Исполнителя".replace("требования", "Требования")) && txt.includes("угроза срыва") && focusIn && closed && back === "help" && pill.includes("1 шаг просрочен") && pill.includes("резерв расходуется") && !errs.length, `${back}; ${errs.join("; ")}`);
    await ctx.close();
  }

  // 12. Ссылки на работу и отбор; сборка для внутреннего контура (Р-66)
  {
    let { ctx, page, errs } = await open(V1, "today=2026-09-28&item=2.1.7");
    const t1 = await page.textContent("#p-title");
    await page.keyboard.press("Escape");
    await page.click('[data-k="tab-focus"]');
    await page.selectOption('[data-k="f-owner"]', "ihs");
    await page.click('[data-k="f-2.2.2"]');
    const url = await page.evaluate(() => location.search);
    await ctx.close();
    ({ ctx, page, errs } = await open(V1, url.slice(1)));
    const t2 = await page.textContent("#p-title"), who = await page.$eval('[data-k="f-owner"]', (e) => e.value), rows = await page.$$eval("button.frow", (e) => e.length);
    ok("Ссылки: ?item открывает карточку; адрес хранит режим, работу и отбор", t1 === "Закупка материалов и оборудования" && /view=focus/.test(url) && /item=2\.2\.2/.test(url) && /who=ihs/.test(url) && t2 === "Работы ИХС по технологии ячеек" && who === "ihs" && rows === 2 && !errs.length, `${url}; строк ${rows}; ${errs.join("; ")}`);
    await ctx.close();
    const OFF = path.join(ROOT, "dist/crm-ymg-iim-stage1-offline.html");
    const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c2.newPage(); const ext = [], e2 = [];
    p2.on("request", (r) => { if (!/^(file|data|about):/.test(r.url())) ext.push(r.url()); });
    p2.on("pageerror", (e) => e2.push(e.message)); p2.on("console", (m) => m.type() === "error" && e2.push(m.text()));
    await p2.goto(`file://${OFF}?today=2026-09-28`, { waitUntil: "load" }); await p2.waitForTimeout(500);
    const h = await p2.textContent("#h-main");
    ok("Сборка для внутреннего контура: ни одного сетевого запроса, консоль без ошибок", !ext.length && !e2.length && h.includes("Этап 1"), ext.concat(e2).join("; "));
    await c2.close();
  }

  // 10. Согласованность чисел между режимами (итоги не расходятся)
  {
    const { ctx, page, errs } = await open(V1, "today=2026-09-28");
    const num = (t) => Number((t.match(/\d+/) || [NaN])[0]);
    const m = await page.evaluate(() => { const M = window.__orbita.model; return { work: M.work.length, base: M.base.length, closed: M.base.filter((i) => i.closed).length, overdue: M.base.filter((i) => i.overdue).length }; });
    const kClosed = num(await page.textContent('[data-k="kpi-closed"] .val')), kOver = num(await page.textContent('[data-k="kpi-overdue"] .val'));
    const secs = await page.$$eval(".srow .n", (e) => e.map((x) => x.textContent));
    const secTotal = secs.reduce((a, t) => a + Number(t.match(/из (\d+)/)[1]), 0), secClosed = secs.reduce((a, t) => a + Number(t.match(/^(\d+)/)[1]), 0);
    const ep = await page.textContent('[data-k="own-ep"] .n'), kv = await page.textContent('[data-k="own-kv"] .n');
    await page.click('[data-k="tab-board"]');
    const board = await page.$$eval(".board .col .cnt", (e) => e.reduce((a, x) => a + Number(x.textContent), 0));
    await page.click('[data-k="tab-focus"]');
    const lanes = await page.$$eval(".hz .val", (e) => e.reduce((a, x) => a + Number(x.textContent), 0));
    const offPlan = await page.evaluate(() => window.SEED.off_plan_closed.length);
    await page.click('[data-k="tab-gantt"]');
    const allSl = num(await page.textContent('[data-k="sl-all"] .sc')), odSl = num(await page.textContent('[data-k="sl-overdue"] .sc'));
    const odWork = await page.evaluate(() => window.__orbita.model.work.filter((i) => i.overdue).length);
    const checks = [
      ["KPI «Выполнено» = выполненные обязательства", kClosed === m.closed],
      ["KPI «Просрочено» = просроченные обязательства", kOver === m.overdue],
      ["Разделы: сумма = база 47, выполнено = KPI", secTotal === m.base && m.base === 47 && secClosed === m.closed],
      ["Исполнитель + действия только Заказчика = база", num(ep.replace(/^\D*\d+\D+/, "")) + 1 === m.base],
      ["Колонки «Статусов» = все работы", board === m.work],
      ["Периоды «Ближайших сроков» = все работы + вне План-графика", lanes === m.work + offPlan],
      ["Срезы «Графика работ»: все = работы, просроченные = просроченные работы", allSl === m.work && odSl === odWork],
    ];
    const bad = checks.filter((c) => !c[1]).map((c) => c[0]);
    ok("Согласованность чисел между режимами (7 сверок)", !bad.length && !errs.length, bad.join("; ") || `база ${m.base}, работ ${m.work}, ЕП: ${ep.trim()}, Заказчик: ${kv.trim()}`);
    await ctx.close();
  }

  await b.close();
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  results.forEach(([r, n, i]) => console.log(`${r}  ${pad(n, 88)} ${i}`));
  const fails = results.filter((r) => r[0] === "FAIL").length;
  console.log(`\nИтого: ${results.length - fails} PASS, ${fails} FAIL`);
  fs.writeFileSync(path.join(OUT, "RESULTS.txt"), results.map((r) => r.join(" | ")).join("\n") + `\nИтого: ${results.length - fails} PASS, ${fails} FAIL\n`);
  process.exit(fails ? 1 : 0);
})();
