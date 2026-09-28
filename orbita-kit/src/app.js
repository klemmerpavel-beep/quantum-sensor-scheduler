/* «Орбита» — интерфейс. Пять режимов, карточка позиции, повестка. SPEC.md §2–9; наименования — Р-55. */
(function () {
  "use strict";
  const E = Engine, C = CONFIG, SEED = window.SEED;
  const VARIANT = window.VARIANT || "panel";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── Иконки Lucide (ISC), штриховые
  const ICONS = {
    chev: '<path d="m6 9 6 6 6-6"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  };
  const ico = (n, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  // ── Хранилище: только удобство, страница работает без него
  const store = {
    ok: true,
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { this.ok = false; return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { this.ok = false; } },
  };
  try { const t = "__orbita_probe__"; window.localStorage.setItem(t, "1"); window.localStorage.removeItem(t); } catch (e) { store.ok = false; }

  // ── Параметры ссылки [SPEC §3]
  const q = new URLSearchParams(location.search);
  const notices = [];
  let T = E.todayLocal(), todayFromLink = false;
  if (q.has("today")) {
    const t = E.parseISO(q.get("today"));
    if (t != null) { T = t; todayFromLink = true; } else notices.push("Параметр today не распознан, использована текущая дата.");
  }
  let orgKey = null, orgName = null;
  if (q.has("org")) {
    if (C.ORGS[q.get("org")]) { orgKey = q.get("org"); orgName = C.ORGS[orgKey]; }
    else notices.push("Параметр org не распознан: открыто полное представление только для просмотра.");
  }
  const exec = q.get("view") === "exec";
  const readonly = exec || q.has("org");
  const VIEWS = [["summary", "Сводка"], ["gantt", "График работ"], ["focus", "Ближайшие сроки"], ["board", "Статусы"], ["milestones", "Вехи"]];
  const viewsAvail = orgKey ? VIEWS.filter(([k]) => k !== "summary") : VIEWS;
  const defaultView = orgKey ? "focus" : VARIANT === "registry" ? "gantt" : "summary";
  let view = exec ? "summary" : q.get("view");
  if (view && !viewsAvail.some(([k]) => k === view)) { notices.push("Параметр view не распознан, открыт режим по умолчанию."); view = null; }
  view = view || defaultView;

  let theme = q.get("theme");
  if (theme !== "light" && theme !== "dark") theme = store.get(C.THEME_KEY) === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);

  // ── Состояние
  let edits = {};
  if (!readonly) { try { edits = JSON.parse(store.get(C.STORAGE_KEY) || "{}") || {}; } catch (e) { edits = {}; } }
  const S = { filters: { owner: "", section: "", search: "" }, slice: "all", collapsed: new Set(), selected: null, closeForm: null, msDate: null, lanes: { later: false, closed: false }, agendaOpen: false, agendaFmt: "talk", helpOpen: false, returnFocus: null };
  let M;
  const saveEdits = () => { if (!readonly) store.set(C.STORAGE_KEY, JSON.stringify(edits)); };
  const recompute = () => { M = E.build(SEED, C, edits, T); };

  // ── Слова и форматы
  const fmt = E.fmt;
  const pl = (n, a, b, c) => E.plural(n, a, b, c);
  const days = (n) => `${n} ${pl(n, "день", "дня", "дней")}`;
  const wdays = (n) => `${n} ${pl(n, "рабочий день", "рабочих дня", "рабочих дней")}`;
  const title = (i) => C.SHORT[i.num] || i.name;
  const nameAttr = (i) => esc(`${i.name} (№ ${i.num} по План-графику)`);
  // Роли [Р-61]: Исполнитель — Электроприбор, отвечает перед Заказчиком за всё, включая работы соисполнителей;
  // ФТИ и ИХС — соисполнители по договорам с Электроприбором; СП «Квант» — Заказчик.
  const EP = "Электроприбор", KV = "СП «Квант»", COS = ["ФТИ им. Иоффе", "ИХС им. Гребенщикова"];
  const CO_SHORT = { "ФТИ им. Иоффе": "ФТИ", "ИХС им. Гребенщикова": "ИХС" };
  const resp = (i) => (i.owners.some((o) => o === EP || COS.includes(o)) ? EP : i.owners.includes(KV) ? KV : i.owners[0]);
  const cosOf = (i) => i.owners.filter((o) => COS.includes(o));
  const OWNER_F = {
    ep: (i) => resp(i) === EP, fti: (i) => i.owners.includes("ФТИ им. Иоффе"), ihs: (i) => i.owners.includes("ИХС им. Гребенщикова"), kv: (i) => i.owners.includes(KV),
  };
  const orgMatch = (i) => !orgKey || (orgKey === "elektropribor" ? resp(i) === EP : i.owners.includes(orgName));
  const showChain = !orgKey;
  /** Ответственный и участники словами: «Электроприбор · соисполнитель ФТИ им. Иоффе». */
  const ownersText = (i) => {
    const r = resp(i), co = cosOf(i);
    if (r === KV) return "СП «Квант» (Заказчик)";
    let t = r;
    if (co.length) t += ` · ${co.length > 1 ? "соисполнители" : "соисполнитель"} ${co.map((o) => (co.length > 1 ? CO_SHORT[o] : o)).join(", ")}`;
    if (i.owners.includes(KV)) t += " · с участием Заказчика";
    return t;
  };
  /** Краткая форма для таблицы: ответственный + метка участников. */
  const ownersCell = (i) => {
    const r = resp(i), tags = cosOf(i).map((o) => CO_SHORT[o]).concat(i.owners.includes(KV) && r !== KV ? ["Заказчик"] : []);
    return `<span title="${esc(ownersText(i))}">${esc(r === KV ? "Заказчик" : r)}${tags.length ? `<span class="co">+ ${esc(tags.join(", "))}</span>` : ""}</span>`;
  };

  /** Статус: цветная точка + слово; пометки — вторичным текстом [Р-16, Р-51]. */
  const status = (i, withNote = true) => {
    if (!i.status) return "";
    let note = "";
    if (withNote && i.src === "inherited") note = "по группе";
    else if (withNote && i.src === "derived") note = "расчётный";
    if (withNote && i.closed && i.noReq) note = "без документа";
    return `<span class="st st-${i.cls}"><i aria-hidden="true"></i>${esc(i.status)}${note ? `<span class="st-note">· ${note}</span>` : ""}</span>`;
  };
  /** Срок словами: «просрочено на 13 дней», «через 2 дня», «выполнено 04.09.2026». */
  const dueWords = (i, compact) => {
    if (i.closed) return compact ? "" : i.closeDate != null ? `<span class="due-t">выполнено ${fmt(i.closeDate)}</span>` : `<span class="due-t">выполнено, дата не указана</span>`;
    if (i.overdue) return `<span class="due-t bad">${compact ? `−${i.overdueDays} дн.` : `просрочено на ${days(i.overdueDays)}`}</span>`;
    if (i.remain === 0) return `<span class="due-t warn">срок сегодня</span>`;
    if (i.soon) return `<span class="due-t warn">${compact ? `через ${i.remain} дн.` : `через ${days(i.remain)}`}</span>`;
    return compact ? "" : `<span class="due-t">через ${days(i.remain)}</span>`;
  };
  const sectionOf = (num) => { const p = num.split("."); return p[0] === "2" ? p.slice(0, 2).join(".") : p[0]; };
  const matchesFilters = (i) => {
    const f = S.filters;
    if (f.owner && OWNER_F[f.owner] && !OWNER_F[f.owner](i)) return false;
    if (f.section && sectionOf(i.num) !== f.section) return false;
    if (f.search) {
      const s = f.search.toLowerCase().trim();
      if (!(i.num.startsWith(s) || i.name.toLowerCase().includes(s) || title(i).toLowerCase().includes(s))) return false;
    }
    return orgMatch(i);
  };
  const anyFilter = () => S.filters.owner || S.filters.section || S.filters.search;

  // ── Шкала этапа
  const D0 = E.dn("2026-08-13"), D1 = E.dn("2027-02-02");
  const xp = (n) => ((Math.min(Math.max(n, D0), D1) - D0) / (D1 - D0)) * 100;
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const monthStarts = () => {
    const out = [];
    for (let y = 2026, m = 8; !(y === 2027 && m > 1); m++) {
      if (m > 11) { m = 0; y++; }
      const n = Date.UTC(y, m, 1) / 86400000;
      if (n > D0 && n < D1) out.push({ n, label: MONTHS[m] });
    }
    return out;
  };
  const MS = SEED.milestones.map((m) => ({ n: E.dn(m.date), title: m.title, date: m.date }));
  const MS_SHORT = {
    "2026-09-30": "Закрытие 3 квартала", "2026-11-16": "Отчёты соисполнителей", "2026-11-24": "Приглашение на демонстрацию",
    "2026-11-30": "Демонстрация лабораторного образца", "2026-12-01": "Передача технического проекта", "2026-12-30": "Окончание этапа 1",
    "2027-01-01": "Начало этапа 2", "2027-02-01": "Акт сдачи-приёмки этапа 1",
  };

  // ── Шапка и уведомления
  function renderHeader() {
    const tabs = viewsAvail.map(([k, t]) => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${k === view}" aria-controls="main" tabindex="${k === view ? 0 : -1}" data-view="${k}" data-k="tab-${k}">${t}</button>`).join("");
    return `<header class="top">
      <div class="brand"><span class="logo" aria-hidden="true"></span><span class="bt"><b>CRM</b><span class="sub">Квантовый сенсор ИИМ ЯМГ (Электроприбор)</span></span></div>
      <nav class="tabs" role="tablist" aria-label="Режимы отображения">${tabs}</nav>
      <div class="spacer"></div>
      <div class="today" title="${todayFromLink ? "Дата задана параметром ссылки" : "Текущая дата"}">на <b class="mono">${fmt(T)}</b></div>
      <button class="iconbtn help" data-act="help" data-k="help" aria-label="Как читать страницу" title="Как читать страницу">${ico("help")}</button>
      <button class="iconbtn print" data-act="print" data-k="print" aria-label="Печать текущего режима" title="Печать">${ico("printer")}</button>
      <button class="iconbtn theme" data-act="theme" data-k="theme" aria-label="${theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}" title="${theme === "dark" ? "Светлая тема" : "Тёмная тема"}">${ico(theme === "dark" ? "sun" : "moon")}</button>
    </header>`;
  }
  function renderBanners() {
    let h = "";
    if (orgKey) h += `<div class="banner" role="status">${orgKey === "elektropribor" ? `Представление для Исполнителя: <b>${esc(orgName)}</b> — все обязательства, включая работы соисполнителей.` : `Представление для соисполнителя: <b>${esc(orgName)}</b> — работы по договору с Электроприбором.`} Только просмотр.</div>`;
    else if (exec) h += `<div class="banner" role="status">Режим для руководства: только просмотр.</div>`;
    notices.forEach((n) => { h += `<div class="banner warn" role="alert">${ico("alert")} ${esc(n)}</div>`; });
    return h;
  }
  function toolbar(extra = "") {
    const ownerOpts = [["ep", "Электроприбор — все обязательства"], ["fti", "Соисполнитель ФТИ им. Иоффе"], ["ihs", "Соисполнитель ИХС им. Гребенщикова"], ["kv", "С участием Заказчика"]];
    const secOpts = [["1", "Запуск"], ["2.1", "3 квартал 2026 года"], ["2.2", "4 квартал 2026 года"], ["3", "Сдача этапа 1"]];
    return `<div class="toolbar" role="search">
      <label class="field search">${ico("search")}<span class="sr">Поиск по наименованию или номеру</span><input type="search" data-f="search" data-k="f-search" placeholder="Поиск работы" value="${esc(S.filters.search)}"></label>
      ${orgKey ? "" : `<label class="field"><span class="sr">Исполнитель</span><select data-f="owner" data-k="f-owner"><option value="">Все участники</option>${ownerOpts.map(([v, t]) => `<option value="${v}" ${S.filters.owner === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`}
      <label class="field"><span class="sr">Раздел</span><select data-f="section" data-k="f-section"><option value="">Все разделы</option>${secOpts.map(([v, t]) => `<option value="${v}" ${S.filters.section === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      ${anyFilter() ? `<button class="btn link" data-act="reset-filters" data-k="reset-f">Сбросить</button>` : ""}
      <div class="spacer"></div>${extra}
    </div>`;
  }
  const emptyFiltered = () => `<div class="empty" role="status"><p>Нет работ, соответствующих условиям. Измените поиск или сбросьте фильтр.</p><button class="btn" data-act="reset-filters" data-k="reset-f2">Сбросить фильтр</button></div>`;

  /** Заголовок режима: вывод одной фразой и, при необходимости, полоса показателей [Р-60]. */
  const pageHead = (id, h, lead, extra = "") => `<section class="phead" aria-labelledby="${id}"><div class="pht"><h1 id="${id}">${esc(h)}</h1>${lead ? `<p>${lead}</p>` : ""}</div>${extra}</section>`;
  /** Подписи вех по дорожкам без наложения; W — ширина полосы в пикселях. */
  function msLabels(W, top) {
    const lanes = []; let h = "";
    MS.forEach((m) => {
      const x = (xp(m.n) / 100) * W, name = MS_SHORT[m.date] || m.title, w = 44 + name.length * 7;
      const right = x + w > W, a = right ? x - w : x, b = right ? x : x + w;
      let lane = lanes.findIndex((r) => a >= r + 12);
      if (lane < 0) { lanes.push(0); lane = lanes.length - 1; }
      lanes[lane] = b;
      h += `<span class="stl-lbl${m.n < T ? " past" : ""}${right ? " r" : ""}" style="left:${xp(m.n)}%;top:${top + lane * 22}px"><b>${fmt(m.n).slice(0, 5)}</b> ${esc(name)}</span>`;
      h += `<span class="stl-tick" style="left:${xp(m.n)}%;top:${top - 22}px;height:${lane * 22 + 22}px"></span>`;
    });
    return { html: h, lanes: lanes.length };
  }
  const bandW = (min) => Math.max(min, (root.clientWidth || innerWidth) - 2 * 32 - 2 * 24);

  // ── СВОДКА
  function headline() {
    const k = M.kpi;
    if (M.work.every((i) => i.closed)) return { h: "Все обязательства этапа 1 выполнены", t: "Просроченных и предстоящих работ нет." };
    const h = k.overdue ? `Этап 1 идёт с отставанием: ${k.overdue} ${pl(k.overdue, "обязательство просрочено", "обязательства просрочены", "обязательств просрочено")}` : "Этап 1 идёт по графику: просроченных обязательств нет";
    let t = `На ${fmt(T)} выполнено ${k.closed} из ${k.base} обязательств перед Заказчиком.`;
    if (k.toDemo > 0) t += ` До демонстрации лабораторного образца — ${wdays(k.toDemoWd)}.`;
    const w = M.chainWindows.find((x) => x.state === "breach") || M.chainWindows.find((x) => x.state === "eroding");
    if (w && w.state === "eroding") t += ` Резерв перед этапом «${title(M.by[w.to])}» почти исчерпан.`;
    if (w && w.state === "breach") t += " Путь к демонстрации под угрозой срыва.";
    return { h, t };
  }
  function kpiTiles() {
    const k = M.kpi;
    const tile = (id, lbl, val, sub, act, tone) => `<button class="kpi${tone ? " " + tone : ""}" data-act="${act}" data-k="kpi-${id}"><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="sub">${sub}</span></button>`;
    return [
      tile("closed", "Выполнено", `${k.closed}<small> из ${k.base}</small>`, `${k.pct} %${k.noReq ? ` · ${k.noReq} без документа` : ""}`, "go-board"),
      tile("plan", "План на сегодня", `${k.reachedClosed}<small> из ${k.reached}</small>`, k.reached ? `срок наступил у ${k.reached}${k.early ? `; ещё ${k.early} — досрочно` : ""}` : "сроки ещё не наступили", "go-overdue"),
      tile("overdue", "Просрочено", `${k.overdue}`, k.overdue ? "по сроку План-графика" : "просроченных обязательств нет", "go-overdue", k.overdue ? "bad" : ""),
      tile("demo", "До демонстрации образца", k.toDemo >= 0 ? `${k.toDemoWd}<small> ${pl(k.toDemoWd, "рабочий день", "рабочих дня", "рабочих дней")}</small>` : `<small>прошла</small>`, "30.11.2026", "go-chain"),
      tile("end", "До окончания этапа", k.toEnd >= 0 ? `${k.toEnd}<small> ${pl(k.toEnd, "день", "дня", "дней")}</small>` : `<small>этап завершён</small>`, "30.12.2026", "go-ms"),
    ].join("");
  }
  /** Полоса сроков этапа: обязательства по неделям, вехи, «сегодня» [Р-58]. */
  function stageTimeline() {
    const weeks = new Map();
    M.base.forEach((i) => {
      const wd = (new Date(i.due * 86400000).getUTCDay() + 6) % 7, wk = i.due - wd;
      const w = weeks.get(wk) || { closed: 0, overdue: 0, open: 0, list: [] };
      w[i.closed ? "closed" : i.overdue ? "overdue" : "open"]++; w.list.push(title(i)); weeks.set(wk, w);
    });
    const max = Math.max(1, ...[...weeks.values()].map((w) => w.list.length));
    const seg = Math.max(4, Math.min(10, Math.floor(96 / max) - 2));
    let h = `<div class="stl-scroll"><div class="stl" role="img" aria-label="Сроки обязательств по неделям этапа с 13.08.2026 по 01.02.2027, вехи и линия «сегодня»">`;
    monthStarts().forEach((m) => { h += `<span class="stl-grid" style="left:${xp(m.n)}%"></span>` + (xp(m.n) < 97 ? `<span class="stl-month" style="left:${xp(m.n)}%">${m.label}</span>` : ""); });
    weeks.forEach((w, wk) => {
      const segs = [];
      ["closed", "overdue", "open"].forEach((c) => { for (let k = 0; k < w[c]; k++) segs.push(`<i class="${c}" style="height:${seg}px"></i>`); });
      h += `<span class="stl-bar" style="left:${xp(wk)}%;width:calc(${xp(wk + 7) - xp(wk)}% - 6px)" title="Неделя с ${fmt(wk)}: ${w.list.length} — ${esc(w.list.join("; "))}">${segs.join("")}${w.list.length >= 3 ? `<b>${w.list.length}</b>` : ""}</span>`;
    });
    h += `<div class="stl-axis"></div>`;
    const lb = msLabels(bandW(720), 144);
    MS.forEach((m) => { h += `<span class="stl-ms${m.n < T ? " past" : ""}" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(m.title)}"></span>`; });
    h += lb.html;
    if (T >= D0 && T <= D1) h += `<div class="stl-today" style="left:${xp(T)}%"><span>сегодня</span></div>`;
    h += `</div></div><div class="legend stl-leg" aria-hidden="true"><span><i class="lg closed"></i>выполнено</span><span><i class="lg overdue-s"></i>просрочено</span><span><i class="lg future"></i>предстоит</span><span><i class="lg ms"></i>веха</span><span>столбик — обязательства со сроком на этой неделе</span></div>`;
    return `<style>.stl{height:${150 + lb.lanes * 22 + 4}px}</style>` + h;
  }
  /** Исполнитель, соисполнители и Заказчик: кто за что отвечает [Р-61]. */
  function ownersBlock() {
    const row = (key, name, role, l, nextWord) => {
      if (!l.length) return "";
      const cl = l.filter((i) => i.closed).length, od = l.filter((i) => i.overdue).length;
      const nx = l.filter((i) => !i.closed && i.due >= T).sort((a, b) => a.due - b.due || a.idx - b.idx)[0];
      const old = l.filter((i) => i.overdue).sort((a, b) => a.due - b.due || a.idx - b.idx)[0];
      return `<li><button class="orow${key === "ep" ? " main" : ""}" data-act="go-owner" data-owner="${key}" data-k="own-${key}">
        <span class="t">${esc(name)}<span class="role">${role}</span></span><span class="n">выполнено ${cl} из ${l.length}${od ? ` · <span class="bad-t">просрочено ${od}</span>` : ""}</span>
        <span class="prog" role="img" aria-label="Выполнено ${cl} из ${l.length}"><i style="width:${(cl / l.length) * 100}%"></i></span>
        <span class="nx">${nx ? `${nextWord} <span class="mono">${fmt(nx.due)}</span> — ${esc(title(nx))}` : old ? `предстоящих сроков нет; дольше всех просрочено — ${esc(title(old))} (срок <span class="mono">${fmt(old.due)}</span>)` : "открытых обязательств нет"}</span></button></li>`;
    };
    const B = M.base;
    return `<ul class="olist">${row("ep", "Электроприбор", "Исполнитель · отвечает перед Заказчиком за все обязательства", B.filter((i) => resp(i) === EP), "ближайший срок")}</ul>
      <p class="osub">Соисполнители — работают по договорам с Электроприбором; требования к ним предъявляются через Исполнителя</p>
      <ul class="olist">${row("fti", "ФТИ им. Иоффе", "соисполнитель", B.filter(OWNER_F.fti), "ближайший срок")}${row("ihs", "ИХС им. Гребенщикова", "соисполнитель", B.filter(OWNER_F.ihs), "ближайший срок")}</ul>
      <p class="osub">Заказчик — работы, где требуется участие СП «Квант»</p>
      <ul class="olist">${row("kv", "СП «Квант»", "Заказчик", B.filter(OWNER_F.kv), "ближайшее")}</ul>`;
  }
  const reason = (t) => {
    const i = t.item;
    if (t.why === "chain-overdue" || t.why === "overdue") return `<span class="due-t bad">Просрочено на ${days(i.overdueDays)}</span>`;
    if (t.why === "ctrl") return `<span class="due-t warn">Контрольная дата прошла ${days(i.ctrlDays)} назад</span>`;
    return `<span class="due-t warn">Срок ${i.remain === 0 ? "сегодня" : `через ${days(i.remain)}`}</span>`;
  };
  function attention() {
    if (!M.top5.length) return `<p class="muted empty-line">${M.work.every((i) => i.closed) ? "Рисков нет: все работы выполнены." : "Просроченных работ и работ со сроком до 7 дней нет."}</p>`;
    return `<ol class="alist">${M.top5.map((t) => { const i = t.item; return `<li><button class="aitem" data-open="${i.num}" data-k="r-${i.num}" title="${nameAttr(i)}">
      <span class="a-t">${esc(title(i))}${M.chainSet.has(i.num) ? `<span class="tag">путь к демонстрации</span>` : ""}</span>
      <span class="a-m">${reason(t)}<span class="sep">·</span><span>${esc(ownersText(i))}</span><span class="sep">·</span><span>срок <span class="mono">${fmt(i.due)}</span></span></span></button></li>`; }).join("")}</ol>`;
  }
  function sectionsBlock() {
    return `<ul class="slist">${M.sections.map((s) => `<li><button class="srow" data-act="go-section" data-sec="${s.num}" data-k="sec-${s.num}">
      <span class="t">${esc(C.SHORT[s.num] || s.name)}</span><span class="n">${s.closed} из ${s.total}${s.overdue ? ` · <span class="bad-t">просрочено ${s.overdue}</span>` : ""}</span>
      <span class="prog" role="img" aria-label="Выполнено ${s.closed} из ${s.total}"><i style="width:${(s.closed / s.total) * 100}%"></i></span></button></li>`).join("")}</ul>`;
  }
  const stepState = (i) => (i.closed ? "done" : i.overdue ? "late" : i.soon ? "soon" : "plan");
  const stepWord = { done: "выполнено", late: "просрочено", soon: "срок близко", plan: "по плану" };
  function pathSteps(big, vert) {
    const steps = M.chainNums.map((n, k) => {
      const i = M.by[n], st = stepState(i), w = M.chainWindows[k - 1];
      if (vert) {
        const link = w ? `<span class="link ${w.state}" aria-hidden="true"></span>` : "";
        const word = st === "late" ? `просрочено на ${days(i.overdueDays)}` : st === "soon" ? (i.remain === 0 ? "срок сегодня" : `через ${days(i.remain)}`) : stepWord[st];
        return `<li class="step ${st}">${link}<button class="dot" data-open="${n}" data-k="cn-${n}" aria-label="${esc(title(i))}: ${word}, срок ${fmt(i.due)}">${st === "done" ? ico("check") : st === "late" ? "!" : k + 1}</button>
        <span class="lbl" title="${nameAttr(i)}">${esc(title(i))}</span>
        <span class="d"><span class="mono">${fmt(i.due)}</span> · ${word} · ${esc(ownersText(i))}</span></li>`;
      }
      const link = w ? `<span class="link ${w.state}" aria-hidden="true"></span>` : "";
      return `<li class="step ${st}">${link}<button class="dot" data-open="${n}" data-k="cn-${n}" aria-label="${esc(title(i))}: ${stepWord[st]}, срок ${fmt(i.due)}">${st === "done" ? ico("check") : st === "late" ? "!" : k + 1}</button>
        <span class="lbl" title="${nameAttr(i)}">${esc(title(i))}</span>
        <span class="d"><span class="mono">${fmt(i.due).slice(0, 5)}</span>${big || st !== "plan" ? ` · ${stepWord[st]}` : ""}</span></li>`;
    }).join("");
    return `<ol class="path${big ? " big" : ""}${vert ? " vert" : ""}" aria-label="Путь к демонстрации лабораторного образца">${steps}</ol>`;
  }
  function pathNotes() {
    const notes = [];
    const all = M.chainWindows.concat([M.feeder]);
    const br = all.filter((w) => w.state === "breach");
    const depth = (w) => Math.min(w.P, 0) - w.R;
    if (br.length > 2) { const w = br.reduce((a, x) => (depth(x) > depth(a) ? x : a)); notes.push(`Срыв на ${br.length} переходах; наибольший — перед этапом «${title(M.by[w.to])}»: ${wdays(depth(w))}.`); }
    else br.forEach((w) => notes.push(`Срыв перед этапом «${title(M.by[w.to])}»: ${wdays(depth(w))}.`));
    all.filter((w) => w.state === "eroding").forEach((w) => notes.push(`Резерв перед этапом «${title(M.by[w.to])}»: осталось ${w.R} из ${wdays(w.P)}${w.breachFrom ? `; если «${title(M.by[w.from])}» не закрыть, срыв с ${fmt(w.breachFrom)}` : ""}.`));
    const ov = M.chainWindows.filter((w) => w.state === "overlap");
    if (ov.length) notes.push(`${ov.length} ${pl(ov.length, "этап выполняется", "этапа выполняются", "этапов выполняются")} параллельно с предыдущими — так заложено в План-графике, это не срыв.`);
    const f = M.by[M.feeder.from];
    notes.push(`Параллельно: «${title(f)}» — срок ${fmt(f.due)}, ${f.closed ? "выполнено" : f.overdue ? "просрочено" : "в работе"}.`);
    return `<ul class="pnotes">${notes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }
  /** Состояние пути: просроченные шаги называются отдельно от состояния резерва [Р-47, Р-65]. */
  const chainPill = () => {
    const s = M.chainState, w = { eroding: "резерв расходуется", breach: "угроза срыва", done: "выполнен", ok: "по плану" }[s];
    const late = M.chainNums.filter((n) => M.by[n].overdue).length;
    return `${late && s !== "breach" ? `<span class="pill breach">${late} ${pl(late, "шаг просрочен", "шага просрочено", "шагов просрочено")}</span>` : ""}<span class="pill ${s}">${w}</span>`;
  };
  function viewSummary() {
    if (VARIANT === "path") return viewSummaryPath();
    const hl = headline();
    return `<div class="page">
      <section class="hero" aria-labelledby="h-main"><h1 id="h-main">${esc(hl.h)}</h1><p>${esc(hl.t)}</p></section>
      <section class="kpis" aria-label="Ключевые показатели">${kpiTiles()}</section>
      <section class="card" aria-labelledby="h-tl"><h2 id="h-tl">Сроки этапа <span class="note">13.08.2026 – 01.02.2027 · ${M.kpi.base} обязательств перед Заказчиком</span><span class="spacer"></span><button class="btn link" data-act="go-ms" data-k="tl-open">Все вехи ${ico("arrow")}</button></h2>${stageTimeline()}</section>
      <div class="cols">
        <div class="stack">
          <section class="card" aria-labelledby="h-r"><h2 id="h-r">Требует внимания</h2>${attention()}</section>
          <section class="card" aria-labelledby="h-o"><h2 id="h-o">Исполнитель и соисполнители <span class="note">по обязательствам перед Заказчиком</span></h2>${ownersBlock()}</section>
        </div>
        <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Путь к демонстрации образца ${chainPill()}<span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">На графике ${ico("arrow")}</button></h2>${pathSteps(false, true)}${pathNotes()}</section>
      </div>
      <section class="card" aria-labelledby="h-s"><h2 id="h-s">Ход работ по разделам</h2>${sectionsBlock()}</section>
    </div>`;
  }
  function viewSummaryPath() {
    const hl = headline();
    return `<div class="page">
      <section class="hero" aria-labelledby="h-main"><h1 id="h-main">${esc(hl.h)}</h1><p>${esc(hl.t)}</p></section>
      <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Путь к демонстрации лабораторного образца ${chainPill()}<span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">Подробно на графике ${ico("arrow")}</button></h2>${pathSteps(true)}${pathNotes()}</section>
      <section class="kpis" aria-label="Ключевые показатели">${kpiTiles()}</section>
      <div class="cols">
        <section class="card" aria-labelledby="h-r"><h2 id="h-r">Требует внимания</h2>${attention()}</section>
        <section class="card" aria-labelledby="h-o"><h2 id="h-o">Исполнитель и соисполнители</h2>${ownersBlock()}</section>
      </div>
    </div>`;
  }

  // ── ГРАФИК РАБОТ (Гант)
  function ganttRows() {
    const vis = new Set();
    const pass = (i) => i.kind !== "section" && matchesFilters(i) && (S.slice === "all" || (S.slice === "overdue" && i.overdue) || (S.slice === "chain" && M.chainSet.has(i.num)));
    const filtering = anyFilter() || S.slice !== "all" || orgKey;
    M.items.forEach((i) => { if (filtering ? pass(i) : true) { vis.add(i.num); let p = i.parent; while (p) { vis.add(p); p = M.by[p].parent; } } });
    const hidden = (i) => { let p = i.parent; while (p) { if (S.collapsed.has(p)) return true; p = M.by[p].parent; } return false; };
    return M.items.filter((i) => vis.has(i.num) && !hidden(i));
  }
  function ganttAxis() {
    let h = `<div class="axis">`;
    monthStarts().forEach((m) => { h += `<span class="m" style="left:${xp(m.n)}%">${m.label}</span>`; });
    MS.forEach((m) => { h += `<span class="msd" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(MS_SHORT[m.date] || m.title)}"></span>`; });
    if (T >= D0 && T <= D1) h += `<span class="todaylbl" style="left:${xp(T)}%">сегодня</span>`;
    return h + `</div>`;
  }
  const monthLines = () => monthStarts().map((m) => `<span class="gm" style="left:${xp(m.n)}%"></span>`).join("");
  function barCell(i) {
    let h = `<div class="grid-bg">${monthLines()}</div>` + (T >= D0 && T <= D1 ? `<span class="todayline" style="left:${xp(T)}%"></span>` : "");
    if (i.kind === "section") return h + `<span class="secspan" style="left:${xp(i.start)}%;width:${xp(i.due + 1) - xp(i.start)}%"></span>`;
    const l = xp(i.start), r = xp(i.due + 1), w = Math.max(r - l, 0.3);
    const derW = i.s.start_derived ? Math.min(w * 0.4, (14 / (D1 - D0)) * 100) : 0;
    const chain = showChain && M.chainSet.has(i.num);
    const g = i.kind === "group";
    h += `<span class="bar ${i.cls}${g ? " group" : ""}${chain ? " chain" : ""}" style="left:${l}%;width:${w}%">`;
    if (derW && !g) h += `<span class="der" style="width:${(derW / w) * 100}%"></span>`;
    if (g) h += `<span class="gp" style="width:${(i.progress.closed / i.progress.total) * 100}%"></span>`;
    if (i.closed) h += `<span class="ok">${ico("check")}</span>`;
    h += `</span>`;
    if (i.overdue) h += `<span class="od" style="left:${r}%;width:${Math.max(xp(T) - r, 0.3)}%"></span>`;
    if (i.ctrl != null && !i.closed) h += `<span class="ctl" style="left:${xp(i.ctrl)}%"></span>`;
    return h;
  }
  const ganttSr = (i) => (i.kind === "section" ? `Раздел, до ${fmt(i.due)}` : `Срок ${fmt(i.due)}; ${i.closed ? "выполнено" : i.overdue ? `просрочено на ${days(i.overdueDays)}` : `через ${days(i.remain)}`}${showChain && M.chainSet.has(i.num) ? "; на пути к демонстрации образца" : ""}`);
  /** Итог раздела: выполнено и просрочено по обязательствам перед Заказчиком. */
  function secSum(num) {
    const l = M.base.filter((i) => (num === "2" ? sectionOf(i.num).startsWith("2.") : sectionOf(i.num) === num) && matchesFilters(i));
    if (!l.length) return "";
    const c = l.filter((i) => i.closed).length, o = l.filter((i) => i.overdue).length;
    return `<span class="ss">выполнено ${c} из ${l.length}</span>${o ? `<span class="bad-t">просрочено ${o}</span>` : ""}`;
  }
  function viewGantt() {
    const rows = ganttRows();
    const nSl = { all: M.work.filter((i) => matchesFilters(i)).length, overdue: M.work.filter((i) => i.overdue && matchesFilters(i)).length, chain: M.chainNums.length };
    const seg = `<div class="seg" role="group" aria-label="Показать">${[["all", "Все работы"], ["overdue", "Просроченные"]].concat(showChain ? [["chain", "Путь к демонстрации"]] : []).map(([k, t]) => `<button aria-pressed="${S.slice === k}" data-slice="${k}" data-k="sl-${k}">${t}<span class="sc${k === "overdue" && nSl.overdue ? " bad" : ""}">${nSl[k]}</span></button>`).join("")}</div>
      ${S.collapsed.size ? `<button class="btn ghost" data-act="expand-all" data-k="exp-all">Развернуть</button>` : `<button class="btn ghost" data-act="collapse-all" data-k="col-all" title="Свернуть до разделов">Свернуть</button>`}`;
    const has = rows.some((i) => i.kind !== "section");
    let body = "";
    if (!has) body = `<tr><td colspan="5">${emptyFiltered()}</td></tr>`;
    else rows.forEach((i) => {
      const sec = i.kind === "section", canCol = sec || i.kind === "group", exp = !S.collapsed.has(i.num);
      const ctx = orgKey && !sec && !orgMatch(i);
      body += `<tr class="${sec ? "sec" : ""}${i.kind === "group" ? " grp" : ""}${S.selected === i.num ? " sel" : ""}" data-open="${i.num}" tabindex="0" data-k="row-${i.num}" ${canCol ? `data-exp="${exp}"` : ""}>
        <td><div class="nm lv${i.level}">${canCol ? `<button class="chev" data-toggle="${i.num}" aria-expanded="${exp}" aria-label="${exp ? "Свернуть" : "Развернуть"}: ${esc(title(i))}" data-k="tg-${i.num}">${ico("chev")}</button>` : `<span class="chev-sp"></span>`}<span class="t" title="${nameAttr(i)}">${esc(title(i))}</span>${i.kind === "group" && !ctx ? `<span class="cnt">${i.progress.closed}/${i.progress.total}</span>` : ""}</div></td>
        ${sec ? `<td colspan="3" class="secsum">${secSum(i.num)}</td>` : `<td class="own">${ownersCell(i)}</td>
        <td class="due"><span class="mono">${fmt(i.due)}</span>${ctx ? "" : dueWords(i, true)}</td>
        <td>${ctx ? "" : status(i)}</td>`}
        <td class="tlcell"><span class="sr">${esc(ganttSr(i))}</span><div aria-hidden="true" class="tlin">${ctx ? "" : barCell(i)}</div></td></tr>`;
    });
    const strip = VARIANT === "registry" && !orgKey ? `<section class="gstrip" aria-label="Ключевые показатели">${kpiTiles()}</section>` : "";
    return `<h1 class="sr">График работ</h1>${strip}${toolbar(seg)}
      <div class="gwrap${strip ? " withstrip" : ""}"><table class="gantt" aria-label="График работ по План-графику этапа 1">
        <colgroup><col class="c-name"><col class="c-own"><col class="c-due"><col class="c-st"><col></colgroup>
        <thead><tr><th scope="col">Работа</th><th scope="col">Исполнитель</th><th scope="col">Срок</th><th scope="col">Статус</th><th scope="col" class="tlcell">${ganttAxis()}</th></tr></thead>
        <tbody>${body}</tbody></table></div>${mobileList(rows)}
      <div class="legend gleg" aria-hidden="true"><span><i class="lg closed"></i>выполнено</span><span><i class="lg progress"></i>в работе</span><span><i class="lg action"></i>требует действия</span><span><i class="lg future"></i>не начато</span><span><i class="lg overdue"></i>просрочено</span><span><i class="lg der"></i>начало — расчётное</span><span><i class="lg ctl"></i>контрольная дата</span>${showChain ? '<span><i class="lg chain"></i>путь к демонстрации</span>' : ""}</div>`;
  }
  function mobileList(rows) {
    const items = rows.filter((i) => i.kind !== "section");
    let h = `<div class="mlist" aria-label="Список работ">`;
    if (!items.length) return h + emptyFiltered() + "</div>";
    rows.forEach((i) => {
      if (i.kind === "section") { if (i.level <= 2) h += `<div class="mhead">${esc(title(i))}</div>`; return; }
      const ctx = orgKey && !orgMatch(i);
      h += `<button class="mcard" data-open="${i.num}" data-k="m-${i.num}"><span class="t">${esc(title(i))}</span><span class="r"><span class="mono">${fmt(i.due)}</span>${ctx ? "" : dueWords(i, true) + status(i)}</span></button>`;
    });
    return h + "</div>";
  }

  // ── БЛИЖАЙШИЕ СРОКИ (Фокус) [Р-60]
  const LANES = [["overdue", "Просрочено"], ["h14", "В ближайшие 14 дней"], ["h30", "В течение месяца"], ["h60", "В течение двух месяцев"], ["later", "Позднее"], ["closed", "Выполнено"]];
  function viewFocus() {
    const list = M.work.filter((i) => matchesFilters(i));
    const range = { overdue: "срок прошёл", h14: `до ${fmt(T + 14)}`, h30: `${fmt(T + 15)} – ${fmt(T + 30)}`, h60: `${fmt(T + 31)} – ${fmt(T + 60)}`, later: `после ${fmt(T + 60)}`, closed: "работы с отметкой «Закрыто»" };
    const off = !orgKey && !anyFilter() ? SEED.off_plan_closed : [];
    const rowsOf = (k) => list.filter((i) => i.horizon === k).sort((a, b) => a.due - b.due || a.idx - b.idx);
    const cnt = Object.fromEntries(LANES.map(([k]) => [k, rowsOf(k).length + (k === "closed" ? off.length : 0)]));
    const ctrl = list.filter((i) => i.ctrlPassed).length;
    const lead = `На ${fmt(T)}: просрочено ${cnt.overdue}, в ближайшие 14 дней — ${cnt.h14}, в течение месяца — ${cnt.h30}, в течение двух месяцев — ${cnt.h60}.${ctrl ? ` У ${ctrl} ${pl(ctrl, "работы", "работ", "работ")} прошла контрольная дата оперативки.` : ""}${anyFilter() ? " Показаны работы по условиям отбора." : ""}`;
    const strip = `<nav class="hstrip" aria-label="Периоды">${LANES.map(([k, t]) => `<button class="hz ${k}${k === "overdue" && cnt[k] ? " bad" : k === "h14" && cnt[k] ? " warn" : ""}" data-act="go-lane" data-lane="${k}" data-k="hz-${k}"><span class="lbl">${t}</span><span class="val">${cnt[k]}</span><span class="sub">${range[k]}</span></button>`).join("")}</nav>`;
    const agendaBtn = readonly ? "" : `<button class="btn primary" data-act="agenda" data-k="agenda">${ico("file")} Повестка оперативки</button>`;
    let h = toolbar(agendaBtn) + `<div class="page">` + pageHead("h-focus", "Ближайшие сроки", esc(lead), strip);
    if (!list.length) return h + emptyFiltered() + `</div>`;
    LANES.forEach(([k, t]) => {
      const rows = rowsOf(k), offk = k === "closed" ? off : [];
      const open = k === "later" || k === "closed" ? S.lanes[k] : true;
      h += `<details class="lane ${k}" ${open ? "open" : ""} data-lane="${k}"><summary data-k="lane-${k}"><span class="chev">${ico("chev")}</span>${t}<span class="cnt">${rows.length + offk.length}</span><span class="rng">${range[k]}</span></summary>`;
      if (!rows.length && !offk.length) h += `<p class="muted empty-line">Работ в этом периоде нет.</p>`;
      else h += `<div class="fhead" aria-hidden="true"><span>Работа</span><span>Исполнитель</span><span>Срок</span><span>${k === "closed" ? "Выполнено" : "Осталось"}</span><span>Статус</span></div>`;
      rows.forEach((i) => {
        h += `<button class="frow" data-open="${i.num}" data-k="f-${i.num}" title="${nameAttr(i)}"><span class="t">${esc(title(i))}${i.src === "inherited" ? `<span class="st-note">в составе «${esc(title(M.by[i.inheritedFrom]))}»</span>` : ""}</span><span class="own">${ownersCell(i)}</span><span class="mono d">${fmt(i.due)}</span><span class="dw">${k === "closed" ? (i.closeDate != null ? `<span class="due-t">${fmt(i.closeDate)}</span>` : `<span class="due-t">дата не указана</span>`) : dueWords(i, false)}</span><span class="stc">${status(i, false)}${i.ctrlPassed ? `<span class="due-t warn">контрольная дата ${fmt(i.ctrl).slice(0, 5)} прошла</span>` : ""}${i.closed && i.noReq ? `<span class="st-note">без документа</span>` : ""}</span></button>`;
      });
      offk.forEach((o) => { h += `<div class="frow" role="note"><span class="t">${esc(o.name)}<span class="st-note">вне План-графика</span></span><span class="own">Электроприбор</span><span class="mono d">${fmt(E.dn(o.transfer))}</span><span class="dw"><span class="due-t">передано</span></span><span class="stc"><span class="st st-closed"><i aria-hidden="true"></i>${esc(o.mark)}</span></span></div>`; });
      h += `</details>`;
    });
    return h + `</div>`;
  }

  // ── СТАТУСЫ (Доска)
  function viewBoard() {
    const list = M.work.filter((i) => matchesFilters(i));
    let h = toolbar();
    if (!list.length) return h + `<h1 class="sr">Статусы</h1>` + emptyFiltered();
    const n = (f) => list.filter(f).length;
    const g = { closed: n((i) => i.cls === "closed"), progress: n((i) => i.cls === "progress"), action: n((i) => i.cls === "action"), future: n((i) => i.cls === "future") };
    const od = n((i) => i.overdue), inh = n((i) => i.src === "inherited");
    const lead = `${list.length} ${pl(list.length, "работа", "работы", "работ")}: выполнено ${g.closed}, в работе ${g.progress}, требуют действия ${g.action}, не начато ${g.future}. Просрочено ${od}${inh ? `; у ${inh} статус взят по группе` : ""}.`;
    const words = { closed: "выполнено", progress: "в работе", action: "требуют действия", future: "не начато" };
    const dist = `<div class="dist" role="img" aria-label="${esc(lead)}">${["closed", "progress", "action", "future"].filter((c) => g[c]).map((c) => `<span class="dseg ${c}" style="flex-grow:${g[c]}" title="${words[c]}: ${g[c]}">${g[c] / list.length >= 0.1 ? `<b>${g[c]}</b> ${words[c]}` : `<b>${g[c]}</b>`}</span>`).join("")}</div>`;
    h += `<div class="bhead">${pageHead("h-board", "Статусы", esc(lead), dist)}</div><div class="board">`;
    E.STATUSES.forEach((st) => {
      const cards = list.filter((i) => i.status === st).sort((a, b) => (b.overdue - a.overdue) || a.due - b.due || a.idx - b.idx);
      h += `<section class="col" aria-label="${st}: ${cards.length}"><h2><span class="st st-${E.CLS[st]}"><i aria-hidden="true"></i>${st}</span><span class="cnt">${cards.length}</span></h2><ul>`;
      if (!cards.length) h += `<li class="muted empty-line">Работ нет.</li>`;
      cards.forEach((i) => {
        h += `<li><button class="bcard${i.overdue ? " late" : ""}" data-open="${i.num}" data-k="b-${i.num}" title="${nameAttr(i)}"><span class="t">${esc(title(i))}</span><span class="o">${esc(ownersText(i))}</span><span class="r"><span class="mono">${fmt(i.due)}</span>${dueWords(i, true)}</span>${i.src === "inherited" ? `<span class="st-note" title="Статус группы «${esc(title(M.by[i.inheritedFrom]))}»">статус по группе</span>` : i.closed && i.noReq ? `<span class="st-note">без подтверждающего документа</span>` : ""}</button></li>`;
      });
      h += `</ul></section>`;
    });
    return h + `</div>`;
  }

  // ── ВЕХИ [Р-60]
  function viewMilestones() {
    const list = M.work.filter((i) => matchesFilters(i));
    const clusters = new Map();
    list.forEach((i) => { const c = clusters.get(i.due) || []; c.push(i); clusters.set(i.due, c); });
    const keys = [...clusters.keys()].sort((a, b) => a - b);
    if (S.msDate == null || !clusters.has(S.msDate)) {
      const near = keys.filter((d) => d >= T && d - T <= 14);
      S.msDate = near.length ? near.reduce((a, d) => (clusters.get(d).length > clusters.get(a).length ? d : a), near[0]) : keys.find((d) => d >= T) ?? keys[keys.length - 1] ?? null;
    }
    const nx = MS.find((m) => m.n >= T);
    const up = keys.filter((d) => d >= T);
    const pk = up.length ? up.reduce((a, d) => (clusters.get(d).length > clusters.get(a).length ? d : a), up[0]) : null;
    const lead = `${nx ? `Следующая веха — ${fmt(nx.n)} «${MS_SHORT[nx.date] || nx.title}», ${nx.n === T ? "сегодня" : `через ${days(nx.n - T)}`}.` : "Все вехи этапа пройдены."}${pk != null ? ` Самая плотная дата впереди — ${fmt(pk)}: ${clusters.get(pk).length} ${pl(clusters.get(pk).length, "работа", "работы", "работ")}.` : ""}`;
    let h = toolbar() + `<div class="page">` + pageHead("h-ms", "Вехи", esc(lead));
    if (!list.length) return h + emptyFiltered() + "</div>";
    const peak = Math.max(...keys.map((d) => clusters.get(d).length));
    const lb = msLabels(bandW(1060), 212);
    h += `<section class="card" aria-labelledby="h-msc"><h2 id="h-msc">Вехи и загрузка по датам <span class="note">столбик — работы со сроком в этот день; нажмите, чтобы увидеть список</span></h2><div class="ms-scroll"><div class="ms-canvas" style="height:${212 + lb.lanes * 22 + 4}px">`;
    monthStarts().forEach((m) => { if (xp(m.n) < 96) h += `<span class="ms-month" style="left:${xp(m.n)}%">${m.label}</span>`; });
    h += `<div class="ms-axis"></div>`;
    keys.forEach((d) => {
      const c = clusters.get(d), cl = c.filter((i) => i.closed).length;
      h += `<button class="ms-cl" style="left:${xp(d)}%" aria-pressed="${S.msDate === d}" data-ms="${d}" data-k="ms-${d}" title="${fmt(d)}: ${c.length}" aria-label="${fmt(d)}: ${c.length} ${pl(c.length, "работа", "работы", "работ")}, выполнено ${cl}">${c.map((i) => `<i class="${i.overdue ? "overdue" : i.cls}"></i>`).join("")}</button>`;
      if (c.length >= 5 || c.length === peak) h += `<span class="ms-cn" style="left:${xp(d)}%;bottom:calc(100% - 180px + ${c.length * 10 + 8}px)"><span class="mono">${fmt(d).slice(0, 5)}</span> · ${c.length}</span>`;
    });
    MS.forEach((m) => { h += `<span class="ms-d${m.n < T ? " past" : ""}" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(m.title)}"></span>`; });
    h += lb.html;
    if (T >= D0 && T <= D1) h += `<div class="ms-today" style="left:${xp(T)}%"><span>сегодня</span></div>`;
    h += `</div></div><label class="ms-pick"><span>Выбрать дату</span><select data-mspick data-k="ms-pick">${keys.map((d) => `<option value="${d}" ${S.msDate === d ? "selected" : ""}>${fmt(d)} — ${clusters.get(d).length} ${pl(clusters.get(d).length, "работа", "работы", "работ")}</option>`).join("")}</select></label><div class="ms-mlist"><ul class="list">${keys.map((d) => { const c = clusters.get(d); return `<li><button class="lrow" data-ms="${d}" data-k="msm-${d}" aria-pressed="${S.msDate === d}"><span class="mono">${fmt(d)}</span><span>${c.length} ${pl(c.length, "работа", "работы", "работ")}</span></button></li>`; }).join("")}</ul></div></section>`;
    // Вехи этапа: готовность к каждой вехе
    const rowsMs = MS.map((m) => {
      const due = M.base.filter((i) => i.due <= m.n && orgMatch(i)), open = due.filter((i) => !i.closed).length, od = due.filter((i) => i.overdue).length;
      const when = m.n < T ? "пройдена" : m.n === T ? "сегодня" : `через ${days(m.n - T)}`;
      const near = keys.filter((d) => d <= m.n).pop();
      return `<li><button class="mrow${m.n < T ? " past" : ""}${nx && m.n === nx.n ? " next" : ""}" data-ms="${near ?? ""}" data-k="mr-${m.date}" title="${esc(m.title)}"><span class="md"><span class="dia" aria-hidden="true"></span><span class="mono">${fmt(m.n)}</span></span><span class="mt">${esc(MS_SHORT[m.date] || m.title)}<span class="mw">${when}</span></span><span class="mr">${due.length ? `к вехе выполнено ${due.length - open} из ${due.length}${od ? ` · <span class="bad-t">просрочено ${od}</span>` : ""}` : "обязательств к этой дате нет"}</span></button></li>`;
    }).join("");
    const sel = S.msDate != null ? clusters.get(S.msDate) : null;
    h += `<div class="cols even"><section class="card" aria-labelledby="h-msl"><h2 id="h-msl">Вехи этапа <span class="note">готовность — по обязательствам перед Заказчиком со сроком до вехи</span></h2><ul class="mlist3">${rowsMs}</ul></section>`;
    h += sel ? `<section class="card" aria-labelledby="h-mss"><h2 id="h-mss">Срок ${fmt(S.msDate)} <span class="note">${sel.length} ${pl(sel.length, "работа", "работы", "работ")}</span></h2><ul class="list">${sel.map((i) => `<li><button class="lrow" data-open="${i.num}" data-k="msl-${i.num}" title="${nameAttr(i)}"><span class="t">${esc(title(i))}<span class="own">${esc(ownersText(i))}</span></span><span class="stc">${status(i)}${dueWords(i, true)}</span></button></li>`).join("")}</ul></section>` : `<section class="card"><p class="muted">Выберите дату на полосе.</p></section>`;
    return h + `</div></div>`;
  }

  // ── КАРТОЧКА ПОЗИЦИИ
  function renderPanel() {
    const i = S.selected && M.by[S.selected];
    if (!i) return "";
    const ctx = orgKey && i.kind !== "section" && !orgMatch(i);
    const dl = (rows) => `<dl>${rows.filter((r) => r[1] != null && r[1] !== "").map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
    let h = `<div class="panel" role="dialog" aria-modal="false" aria-labelledby="p-title">
      <div class="phdr"><div class="ph"><h2 id="p-title" tabindex="-1">${esc(title(i))}</h2><p class="pnum">№ ${i.num} по План-графику · <button class="btn link plink" data-act="copy-link" data-k="p-link">${ico("copy")} Ссылка на работу</button><span class="note" id="p-link-st" role="status"></span></p></div><button class="iconbtn" data-act="close-panel" data-k="p-close" aria-label="Закрыть карточку">${ico("x")}</button></div><div class="body">`;
    if (i.kind === "section") return h + `<p class="muted">Раздел План-графика «${esc(i.name)}». Период ${fmt(i.start)} – ${fmt(i.due)}; даты вычислены по вложенным работам.</p></div></div>`;
    if (!ctx) {
      h += `<section class="pstat"><div class="pline">${status(i)} ${dueWords(i, false)}${i.ctrlPassed ? ` <span class="due-t warn">контрольная дата ${fmt(i.ctrl)} прошла</span>` : ""}</div>`;
      if (i.src === "inherited") h += `<p class="note">Отдельной отметки нет — показан статус группы «${esc(title(M.by[i.inheritedFrom]))}».</p>`;
      if (i.src === "derived") h += `<p class="note">Статус группы в данных не задан и вычислен по составу работ.</p>`;
      if (i.kind === "group") h += `<p class="note">В составе: выполнено ${i.progress.closed} из ${i.progress.total}.</p>`;
      if (showChain && M.chainSet.has(i.num)) {
        const k = M.chainNums.indexOf(i.num), pv = M.chainNums[k - 1], nx = M.chainNums[k + 1];
        h += `<p class="note">Шаг ${k + 1} из ${M.chainNums.length} пути к демонстрации лабораторного образца. Окончание — не ранее ${fmt(M.F[i.num])}.</p>`;
        h += `<div class="pnav">${pv ? `<button class="btn ghost" data-open="${pv}" data-k="pn-prev">← ${esc(title(M.by[pv]))}</button>` : ""}${nx ? `<button class="btn ghost" data-open="${nx}" data-k="pn-next">${esc(title(M.by[nx]))} →</button>` : ""}</div>`;
      }
      if (!readonly) {
        h += `<div class="stseg" role="group" aria-label="Изменить статус">${E.STATUSES.map((st) => `<button aria-pressed="${(S.closeForm && S.closeForm.num === i.num ? "Закрыто" : i.status) === st}" data-status="${st}" data-k="st-${st}">${st}</button>`).join("")}</div>`;
        if (S.closeForm && S.closeForm.num === i.num) {
          const f = S.closeForm, noName = !f.name.trim();
          h += `<div class="form"><b>Подтверждающий документ</b>
            <label>Наименование документа<input data-cf="name" data-k="cf-name" value="${esc(f.name)}"></label>
            <div class="row2"><label>№ письма<input data-cf="letter" data-k="cf-letter" value="${esc(f.letter)}"></label>
            <label>Дата (ДД.ММ.ГГГГ)<input inputmode="numeric" data-cf="date" data-k="cf-date" value="${esc(f.date)}" aria-invalid="${f.dateBad ? "true" : "false"}"></label></div>
            ${f.dateBad ? `<span class="due-t bad" role="alert">Укажите дату в формате ДД.ММ.ГГГГ, например ${fmt(T)}.</span>` : ""}
            ${noName ? `<div class="warnbox" role="alert">${ico("alert")}<span>Работа будет отмечена выполненной без подтверждающего документа.</span></div>` : ""}
            <div class="actions"><button class="btn primary" data-act="do-close" data-k="cf-do">${noName ? "Закрыть без документа" : "Отметить выполненной"}</button><button class="btn" data-act="cancel-close" data-k="cf-cancel">Отменить</button></div></div>`;
        }
        if (edits[i.num]) h += `<button class="btn link" data-act="reset-one" data-k="p-reset">${ico("reset")} Вернуть исходные данные</button>`;
      }
      h += `</section>`;
    }
    h += `<section><h3>Сроки</h3>${dl([
      ["Срок по План-графику", `<span class="mono">${fmt(i.due)}</span>${i.s.due_qualifier ? ` (${esc(i.s.due_qualifier)})` : ""}`],
      ["Предоставить Заказчику", i.dueCust != null ? `<span class="mono">${fmt(i.dueCust)}</span>${i.s.due_to_customer_qualifier ? ` (${esc(i.s.due_to_customer_qualifier)})` : ""}` : null],
      ["Контрольная дата", i.ctrl != null ? `<span class="mono">${fmt(i.ctrl)}</span>` : null],
      ["Выполнено", i.closed ? (i.closeDate != null ? `<span class="mono">${fmt(i.closeDate)}</span>` : "дата не указана") : null],
    ])}</section>`;
    if (i.parent && M.by[i.parent].kind === "group") { const g = M.by[i.parent]; h += `<section><h3>Входит в группу</h3><button class="btn link" data-open="${g.num}" data-k="pg-${g.num}">${esc(title(g))}</button><span class="muted"> · выполнено ${g.progress.closed} из ${g.progress.total}</span></section>`; }
    if (i.kind === "group") h += `<section><h3>Состав группы</h3><ul class="plist">${i.children.map((c) => `<li><button data-open="${c.num}" data-k="pc-${c.num}"><span class="t">${esc(title(c))}</span>${status(c, false)}<span class="d">${fmt(c.due)}${c.overdue ? ` · <span class="bad-t">−${c.overdueDays} дн.</span>` : ""}</span></button></li>`).join("")}</ul></section>`;
    h += `<section><h3>Официальное наименование</h3><p>${esc(i.name)}</p></section>`;
    {
      const co = cosOf(i), r = resp(i);
      h += `<section><h3>Ответственность</h3>${dl([
        ["Отвечает перед Заказчиком", r === KV ? "СП «Квант» (Заказчик)" : "АО «Концерн «ЦНИИ «Электроприбор» (Исполнитель)"],
        [co.length > 1 ? "Соисполнители" : "Соисполнитель", co.length ? `${esc(co.join(", "))} — по договору с Электроприбором; требования — через Исполнителя` : null],
        ["Участие Заказчика", i.owners.includes(KV) && r !== KV ? "требуется участие СП «Квант»" : null],
        ["В План-графике", esc(i.s.owner_raw || "—")],
      ])}</section>`;
    }
    if (i.s.output_doc) h += `<section><h3>Представляемые документы</h3><p>${esc(i.s.output_doc)}</p></section>`;
    if (i.closed && i.edit && i.edit.closeDoc) { const cd = i.edit.closeDoc; h += `<section><h3>Подтверждающий документ</h3><p>${cd.name ? esc(cd.name) : "не указан"}${cd.letter ? `, № ${esc(cd.letter)}` : ""}${cd.date ? `, ${fmt(E.dn(cd.date))}` : ""}</p></section>`; }
    if (i.s.status_mark) h += `<section><h3>Отметка вкладки «Важное»</h3><p>${esc(i.s.status_mark)}</p></section>`;
    h += `<section><h3>Комментарий руководителя</h3>${readonly ? `<p>${esc(i.comment || "—")}</p>` : `<label class="sr" for="p-comment">Комментарий</label><textarea id="p-comment" data-comment="${i.num}" data-k="p-comment" placeholder="Факты: документ, дата, договорённость">${esc(i.comment)}</textarea>`}</section>`;
    const links = C.LINKS.filter(([a, b]) => a === i.num || b === i.num);
    if (links.length) h += `<section><h3>Связанные работы</h3><ul class="list">${links.map(([a, b]) => { const o = M.by[a === i.num ? b : a]; return `<li><button class="btn link" data-open="${o.num}" data-k="lk-${o.num}">${esc(title(o))}</button></li>`; }).join("")}</ul></section>`;
    h += `<details class="more"><summary>Основание и примечание План-графика</summary>${dl([["Документ, определяющий исполнение", esc(i.s.execution_doc || "—")], ["Основание включения", esc(i.s.basis || "—")], ["Примечание", i.s.plan_note ? esc(i.s.plan_note) : null], ["Начало", `<span class="mono">${fmt(i.start)}</span> — расчётное, только для графика`]])}</details>`;
    return h + `</div></div>`;
  }

  // ── Повестка [Р-62]: «для обсуждения» — наименования без номеров; «для письма Исполнителю» — формат Р-33 с п. N
  function agendaTalk(a) {
    const why = (i, sec) => {
      if (sec === 0) {
        if (i.overdue) return `просрочено на ${days(i.overdueDays)} (срок ${fmt(i.due)})`;
        return `просрочены: ${i.overdueSubs.map((n) => title(M.by[n])).join(", ")}`;
      }
      if (sec === 1) return `контрольная дата ${fmt(i.ctrl)} прошла, срок ${fmt(i.due)}`;
      return i.remain === 0 ? "срок сегодня" : `срок ${fmt(i.due)}, через ${days(i.remain)}`;
    };
    const note = (i) => {
      const co = cosOf(i), t = [];
      if (co.length) t.push(`${co.length > 1 ? "соисполнители" : "соисполнитель"} ${co.map((o) => CO_SHORT[o]).join(", ")} — через Исполнителя`);
      if (i.owners.includes(KV)) t.push("требуется участие Заказчика");
      return t.length ? ` [${t.join("; ")}]` : "";
    };
    const out = [`Повестка оперативки по этапу 1 ОКР «ЯМГ-ИИМ» на ${fmt(T)}`, "Вопросы к Исполнителю — АО «Концерн «ЦНИИ «Электроприбор»", ""];
    ["1. Просрочено", "2. Контрольная дата прошла", "3. Срок в ближайшие 14 дней"].forEach((h, k) => {
      out.push(h);
      if (!a.lists[k].length) out.push("— вопросов нет");
      a.lists[k].forEach((i, n) => { const c = i.comment || i.s.status_mark || ""; out.push(`${n + 1}. ${title(i)} — ${why(i, k)}${c ? `. ${c}` : ""}${note(i)}`); });
      out.push("");
    });
    return out.join("\n").trim();
  }
  function renderAgenda() {
    if (!S.agendaOpen) return "";
    const a = E.agenda(M), letter = S.agendaFmt === "letter";
    const text = letter ? a.text : agendaTalk(a);
    const seg = `<div class="seg" role="group" aria-label="Формат повестки"><button aria-pressed="${!letter}" data-act="ag-fmt" data-fmt="talk" data-k="ag-talk">Для обсуждения</button><button aria-pressed="${letter}" data-act="ag-fmt" data-fmt="letter" data-k="ag-letter">Для письма Исполнителю</button></div>`;
    return `<div class="modal-back" data-act="close-agenda-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ag-title">
      <div class="mhdr"><div class="mh"><h2 id="ag-title">Повестка оперативки на ${fmt(T)}</h2><p class="note">Вопросы к Исполнителю — Электроприбору; по работам соисполнителей спрос через него</p></div><button class="iconbtn" data-act="close-agenda" data-k="ag-x" aria-label="Закрыть">${ico("x")}</button></div>
      <div class="agbar"><div class="agc"><span class="agn bad">${a.counts[0]}</span>просрочено</div><div class="agc"><span class="agn warn">${a.counts[1]}</span>контрольная дата прошла</div><div class="agc"><span class="agn">${a.counts[2]}</span>срок в 14 дней</div><span class="spacer"></span>${seg}</div>
      <p class="note mp">${letter ? "Официальные наименования и номера пунктов План-графика — формат писем Исполнителю: «Наименование — комментарий (п. N)»." : "Краткие наименования работ без номеров; причина и комментарий словами, участие соисполнителей и Заказчика — в скобках."} Учитываются обязательства перед Заказчиком; просроченные подпозиции указаны в строке своей группы, поэтому число меньше, чем в «Ближайших сроках».</p>
      <label class="sr" for="ag-text">Текст повестки</label><textarea id="ag-text" readonly data-k="ag-text">${esc(text)}</textarea><div class="ag-print" aria-hidden="true">${esc(text)}</div>
      <div class="mftr"><span class="note" id="ag-status" role="status"></span><button class="btn" data-act="print" data-k="ag-print">${ico("printer")} Печать</button><button class="btn primary" data-act="copy-agenda" data-k="ag-copy">${ico("copy")} Скопировать</button><button class="btn" data-act="close-agenda" data-k="ag-close">Закрыть</button></div></div></div>`;
  }

  // ── Справка «Как читать страницу» [Р-65]
  function renderHelp() {
    if (!S.helpOpen) return "";
    const dot = (cls, w) => `<span class="st st-${cls}"><i aria-hidden="true"></i>${w}</span>`;
    return `<div class="modal-back" data-act="close-help-bg"><div class="modal help" role="dialog" aria-modal="true" aria-labelledby="hp-title">
      <div class="mhdr"><div class="mh"><h2 id="hp-title">Как читать страницу</h2><p class="note">Планер статуса этапа 1 ОКР «ЯМГ-ИИМ» по План-графику и вкладке «Важное», редакция на 28.09.2026</p></div><button class="iconbtn" data-act="close-help" data-k="hp-x" aria-label="Закрыть">${ico("x")}</button></div>
      <div class="hbody">
        <section><h3>Кто за что отвечает</h3><ul>
          <li><b>Электроприбор</b> — Исполнитель по договору. Отвечает перед Заказчиком за все обязательства, в том числе за работы соисполнителей.</li>
          <li><b>ФТИ им. Иоффе и ИХС им. Гребенщикова</b> — соисполнители по договорам с Электроприбором. Требования к ним предъявляются через Исполнителя; в таблицах они показаны пометкой «+ ФТИ», «+ ИХС».</li>
          <li><b>СП «Квант»</b> — Заказчик. Пометка «+ Заказчик» означает, что для работы нужно участие Заказчика.</li></ul></section>
        <section><h3>Статусы</h3><ul class="hst">
          <li>${dot("closed", "Закрыто")} — работа выполнена; пометка «без документа» — закрыта без реквизита подтверждающего документа.</li>
          <li>${dot("progress", "В работе")}, ${dot("progress", "Подготовка материалов")} — идёт по графику.</li>
          <li>${dot("action", "Ожидаем документ")}, ${dot("action", "На согласовании")}, ${dot("action", "Нет отметки")} — нужно действие.</li>
          <li>${dot("future", "Не начато")} — срок впереди.</li>
          <li>«по группе» — у подпозиции нет своей отметки, показан статус её группы.</li></ul></section>
        <section><h3>Сроки</h3><ul>
          <li><b>Просрочено</b> — срок План-графика прошёл, а работа не закрыта. Считается от даты «на ДД.ММ.ГГГГ» в шапке.</li>
          <li><b>Контрольная дата</b> — дата, назначенная на оперативке; её пропуск — повод для вопроса, но не просрочка по договору.</li>
          <li><b>Обязательства перед Заказчиком</b> — 47 из 71 позиций План-графика. Показатели «Сводки» считаются по ним; внутренние подпозиции входят в свою группу.</li></ul></section>
        <section><h3>Путь к демонстрации лабораторного образца</h3><ul>
          <li>8 работ, без которых демонстрация 30.11.2026 невозможна. Между шагами — резерв в рабочих днях по производственному календарю РФ.</li>
          <li><b>по плану</b> — резерв не расходуется; <b>резерв расходуется</b> — предыдущий шаг задерживается, но срыва ещё нет; <b>угроза срыва</b> — резерва не осталось. Число просроченных шагов показывается отдельной красной меткой.</li>
          <li>Пунктир между шагами — работы идут параллельно, так заложено в План-графике; это не срыв.</li></ul></section>
        <section><h3>Режимы</h3><ul>
          <li><b>Сводка</b> — вывод, показатели, сроки этапа, что требует внимания, путь к демонстрации.</li>
          <li><b>График работ</b> — все работы на шкале этапа; срезы «Просроченные» и «Путь к демонстрации».</li>
          <li><b>Ближайшие сроки</b> — работы по периодам и повестка оперативки.</li>
          <li><b>Статусы</b> — работы по колонкам статусов. <b>Вехи</b> — ключевые даты этапа и загрузка по дням.</li>
          <li>Нажатие на работу открывает карточку: официальное наименование, номер пункта, ответственность, документы, комментарий.</li></ul></section>
        <section><h3>Отметки</h3><ul>
          <li>Смена статуса и комментарии сохраняются только в этом браузере и не видны другим. Исходные данные План-графика не меняются; «Сбросить отметки» в подвале возвращает исходное состояние.</li></ul></section>
      </div>
      <div class="mftr"><button class="btn primary" data-act="close-help" data-k="hp-close">Понятно</button></div></div></div>`;
  }

  // ── Отрисовка
  const root = document.getElementById("app");
  function render() {
    const act = document.activeElement;
    const fk = act && act.getAttribute && act.getAttribute("data-k");
    const sel = act && "selectionStart" in act ? [act.selectionStart, act.selectionEnd] : null;
    const scrollers = [...document.querySelectorAll(".gwrap,.board,.panel .body,.ms-scroll")].map((e) => [e.className.split(" ")[0], e.scrollTop, e.scrollLeft]);
    recompute();
    let main;
    try { main = { summary: viewSummary, gantt: viewGantt, focus: viewFocus, board: viewBoard, milestones: viewMilestones }[view](); }
    catch (err) { console.error(err); main = `<div class="empty" role="alert"><p>Не удалось построить отображение. Обновите страницу; если ошибка повторится, сообщите руководителю проекта.</p></div>`; }
    root.innerHTML = `<a class="skip" href="#main">Перейти к содержанию</a>${renderHeader()}${renderBanners()}
      <main id="main" tabindex="-1" class="v-${view}"><div class="tabpanel" role="tabpanel" aria-labelledby="tab-${view}">${main}</div></main>
      <footer class="foot"><span>Источник — План-график этапа 1 и вкладка «Важное», редакция на 28.09.2026.</span><span title="${esc(C.HOLIDAYS_NOTE)}">Рабочие дни — по производственному календарю РФ, включая переносы 2026–2027 годов.</span>${!store.ok ? "<span>Отметки хранятся только до перезагрузки страницы.</span>" : ""}${!readonly && Object.keys(edits).length ? `<button class="btn link" data-act="reset-all" data-k="reset-all">Сбросить отметки (${Object.keys(edits).length})</button>` : ""}</footer>
      ${renderPanel()}${renderAgenda()}${renderHelp()}`;
    scrollers.forEach(([cls, t, l]) => { const e = document.getElementsByClassName(cls)[0]; if (e) { e.scrollTop = t; e.scrollLeft = l; } });
    syncUrl();
    if (fk) { const el = root.querySelector(`[data-k="${CSS.escape(fk)}"]`); if (el) { el.focus({ preventScroll: true }); if (sel && "setSelectionRange" in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* не текстовое поле */ } } }
  }
  /** Адрес страницы отражает режим, открытую работу и отбор — ссылку можно передать [Р-66]. */
  function syncUrl() {
    const u = new URL(location.href), set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    u.searchParams.set("view", exec && view === "summary" ? "exec" : view);
    set("item", S.selected); set("who", orgKey ? "" : S.filters.owner); set("sec", S.filters.section);
    try { history.replaceState(null, "", u); } catch (e) { /* file:// в некоторых браузерах */ }
  }
  function setView(v) {
    view = v; S.closeForm = null;
    render();
    const t = document.getElementById("tab-" + v); if (t) t.focus();
  }
  function openItem(num, from) { S.returnFocus = from && from.getAttribute("data-k"); S.selected = num; S.closeForm = null; render(); const h = document.getElementById("p-title"); if (h) h.focus(); }
  function closePanel() { S.selected = null; S.closeForm = null; render(); if (S.returnFocus) { const el = root.querySelector(`[data-k="${CSS.escape(S.returnFocus)}"]`); if (el) el.focus(); } }
  function setEdit(num, patch) {
    edits[num] = Object.assign({}, edits[num] || {}, patch);
    Object.keys(edits[num]).forEach((k) => { if (edits[num][k] === undefined) delete edits[num][k]; });
    if (!Object.keys(edits[num]).length) delete edits[num];
    saveEdits();
  }
  const clearFilters = () => { S.filters = { owner: "", section: "", search: "" }; };

  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act],[data-view],[data-open],[data-toggle],[data-slice],[data-status],[data-ms]");
    if (!t) return;
    if (t.dataset.view) return setView(t.dataset.view);
    if (t.dataset.toggle) { ev.stopPropagation(); const n = t.dataset.toggle; S.collapsed.has(n) ? S.collapsed.delete(n) : S.collapsed.add(n); return render(); }
    if (t.dataset.slice) { S.slice = t.dataset.slice; return render(); }
    if (t.dataset.ms) { S.msDate = Number(t.dataset.ms); return render(); }
    if (t.dataset.status) {
      const i = M.by[S.selected], st = t.dataset.status;
      if (st === "Закрыто") { S.closeForm = { num: i.num, name: i.s.output_doc || "", letter: "", date: fmt(T) }; return render(); }
      S.closeForm = null; setEdit(i.num, { status: st, closeDoc: undefined }); return render();
    }
    if (t.dataset.open && !t.dataset.act) return openItem(t.dataset.open, t);
    const a = t.dataset.act;
    if (a === "copy-link") {
      const st = document.getElementById("p-link-st"), url = location.href;
      const done = () => { if (st) st.textContent = " Ссылка скопирована."; };
      const manual = () => { if (st) st.textContent = ` ${url}`; };
      try { navigator.clipboard.writeText(url).then(done, manual); } catch (e) { manual(); }
      return;
    }
    if (a === "help") { S.returnFocus = "help"; S.helpOpen = true; render(); const c = document.querySelector('[data-k="hp-close"]'); if (c) c.focus(); return; }
    if (a === "close-help" || (a === "close-help-bg" && ev.target === t)) { S.helpOpen = false; render(); const b = document.querySelector('[data-k="help"]'); if (b) b.focus(); return; }
    if (a === "print") { try { window.print(); } catch (e) { /* печать недоступна */ } return; }
    if (a === "theme") { theme = theme === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", theme); store.set(C.THEME_KEY, theme); return render(); }
    if (a === "reset-filters") { clearFilters(); S.slice = "all"; return render(); }
    if (a === "collapse-all") { M.items.filter((i) => i.kind === "section" && i.num !== "2").forEach((i) => S.collapsed.add(i.num)); return render(); }
    if (a === "expand-all") { S.collapsed.clear(); return render(); }
    if (a === "go-overdue") { S.slice = "overdue"; clearFilters(); return setView("gantt"); }
    if (a === "go-chain") { S.slice = "chain"; clearFilters(); return setView("gantt"); }
    if (a === "go-board") return setView("board");
    if (a === "go-ms") return setView("milestones");
    if (a === "go-lane") {
      const k = t.dataset.lane; if (k in S.lanes) S.lanes[k] = true; render();
      const d = root.querySelector(`details[data-lane="${k}"]`); if (d) { d.scrollIntoView({ block: "start", behavior: "smooth" }); const sm = d.querySelector("summary"); if (sm) sm.focus({ preventScroll: true }); }
      return;
    }
    if (a === "go-owner") { S.slice = "all"; clearFilters(); S.filters.owner = t.dataset.owner; return setView("focus"); }
    if (a === "go-section") { S.slice = "all"; clearFilters(); S.filters.section = t.dataset.sec; S.collapsed.clear(); return setView("gantt"); }
    if (a === "close-panel") return closePanel();
    if (a === "cancel-close") { S.closeForm = null; return render(); }
    if (a === "do-close") {
      const f = S.closeForm, m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(f.date.trim());
      const iso = m && E.parseISO(`${m[3]}-${m[2]}-${m[1]}`) != null ? `${m[3]}-${m[2]}-${m[1]}` : null;
      if (!iso) { f.dateBad = true; render(); const d = document.querySelector('[data-k="cf-date"]'); if (d) d.focus(); return; }
      setEdit(f.num, { status: "Закрыто", closeDoc: { name: f.name.trim(), letter: f.letter.trim(), date: iso } });
      S.closeForm = null; return render();
    }
    if (a === "reset-one") { delete edits[S.selected]; saveEdits(); S.closeForm = null; return render(); }
    if (a === "reset-all") { edits = {}; saveEdits(); S.closeForm = null; return render(); }
    if (a === "agenda") { S.agendaOpen = true; render(); const c = document.querySelector('[data-k="ag-copy"]'); if (c) c.focus(); return; }
    if (a === "close-agenda" || (a === "close-agenda-bg" && ev.target === t)) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
    if (a === "ag-fmt") { S.agendaFmt = t.dataset.fmt; render(); const b = document.querySelector(`[data-k="ag-${t.dataset.fmt === "letter" ? "letter" : "talk"}"]`); if (b) b.focus(); return; }
    if (a === "copy-agenda") {
      const ta = document.getElementById("ag-text"), st = document.getElementById("ag-status");
      const done = () => { st.textContent = "Текст скопирован."; };
      const manual = () => { ta.focus(); ta.select(); st.textContent = "Автоматическое копирование недоступно: текст выделен, скопируйте его вручную."; };
      try { navigator.clipboard.writeText(ta.value).then(done, manual); } catch (e) { manual(); }
    }
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.f) { S.filters[t.dataset.f] = t.value; render(); }
    else if (t.dataset.cf) { S.closeForm[t.dataset.cf] = t.value; if (t.dataset.cf === "name") render(); }
    else if (t.dataset.comment) setEdit(t.dataset.comment, { comment: t.value || undefined });
  });
  root.addEventListener("change", (ev) => { if (ev.target.dataset.mspick !== undefined) { S.msDate = Number(ev.target.value); render(); } });
  root.addEventListener("change", (ev) => { if (ev.target.dataset.comment) render(); });
  root.addEventListener("toggle", (ev) => { const d = ev.target; if (d.dataset && d.dataset.lane in S.lanes) S.lanes[d.dataset.lane] = d.open; }, true);
  root.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (t.getAttribute("role") === "tab" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
      const tabs = [...root.querySelectorAll('[role="tab"]')], k = tabs.indexOf(t);
      tabs[(k + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].focus(); ev.preventDefault(); return;
    }
    if (t.tagName === "TR" && t.dataset.open) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); return openItem(t.dataset.open, t); }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { const s = ev.key === "ArrowDown" ? t.nextElementSibling : t.previousElementSibling; if (s) s.focus(); ev.preventDefault(); return; }
      if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && t.hasAttribute("data-exp")) { if (ev.key === "ArrowLeft") S.collapsed.add(t.dataset.open); else S.collapsed.delete(t.dataset.open); ev.preventDefault(); return render(); }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (S.helpOpen) { S.helpOpen = false; render(); const b = document.querySelector('[data-k="help"]'); if (b) b.focus(); return; }
      if (S.agendaOpen) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
      if (S.selected) closePanel();
      return;
    }
    if (ev.key === "Tab" && (S.agendaOpen || S.helpOpen)) {
      const m = document.querySelector(".modal"); if (!m) return;
      const f = [...m.querySelectorAll("button, textarea")], first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
      else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
    }
  });

  // Печать всегда в светлой теме [Р-63]
  window.addEventListener("beforeprint", () => { document.documentElement.setAttribute("data-theme", "light"); });
  window.addEventListener("afterprint", () => { document.documentElement.setAttribute("data-theme", theme); });
  // Параметры item, who, sec [Р-66]
  if (q.has("item")) { const n = q.get("item"); if (SEED.items.some((i) => i.num === n && i.kind !== "section")) S.selected = n; else notices.push("Параметр item не распознан: работа с таким номером не найдена."); }
  if (q.has("who") && !orgKey) { const w = q.get("who"); if (OWNER_F[w]) S.filters.owner = w; else notices.push("Параметр who не распознан, отбор по участнику не применён."); }
  if (q.has("sec")) { const c = q.get("sec"); if (["1", "2.1", "2.2", "3"].includes(c)) S.filters.section = c; else notices.push("Параметр sec не распознан, отбор по разделу не применён."); }
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if ((view === "summary" || view === "milestones") && !S.agendaOpen) render(); }, 150); });

  if (!SEED || !Array.isArray(SEED.items) || !SEED.items.length) { root.innerHTML = `<div class="empty" role="alert"><p>Данные План-графика не загружены. Страница не может построить отображение. Обратитесь к руководителю проекта.</p></div>`; return; }
  render();
  window.__orbita = { get model() { return M; }, setView, openItem };
})();
