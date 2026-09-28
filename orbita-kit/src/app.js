/* «Орбита» — интерфейс. Отрисовка пяти режимов, боковой панели и повестки. SPEC.md §2–9. */
(function () {
  "use strict";
  const E = Engine, C = CONFIG, SEED = window.SEED;
  const VARIANT = window.VARIANT || "panel";
  const $ = (s, r = document) => r.querySelector(s);
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
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  };
  const ico = (n, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  // ── Безопасное хранилище (удобство; страница работает без него)
  const store = {
    ok: true,
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { this.ok = false; return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { this.ok = false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { this.ok = false; } },
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
  const VIEWS = [["summary", "Сводка"], ["gantt", "Гант"], ["focus", "Фокус"], ["board", "Доска"], ["milestones", "Вехи"]];
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
  const S = {
    filters: { owner: "", section: "", search: "" }, slice: "all", collapsed: new Set(), selected: null,
    closeForm: null, msDate: null, lanes: { later: false, closed: false }, agendaOpen: false, returnFocus: null,
  };
  let M;
  const saveEdits = () => { if (!readonly) store.set(C.STORAGE_KEY, JSON.stringify(edits)); };
  const recompute = () => { M = E.build(SEED, C, edits, T); };

  // ── Помощники отображения
  const fmt = E.fmt;
  const orgMatch = (i) => !orgKey || i.owners.includes(orgName);
  const showChain = !orgKey;
  const statusBadge = (i, short) => {
    if (!i.status) return "";
    let note = "";
    if (i.src === "inherited") note = short ? " · по гр." : ` · по группе ${i.inheritedFrom}`;
    else if (i.src === "derived") note = " · расчётный";
    if (i.closed && i.noReq) note += short ? " · без рекв." : " · без реквизита";
    const cls = i.overdue && i.status === "Нет отметки" ? "overdue" : i.cls;
    return `<span class="badge ${cls}" title="${esc(i.status + note)}">${esc(i.status)}${note ? `<span class="note-in">${esc(note)}</span>` : ""}</span>`;
  };
  const flagDue = (i) => {
    if (!i || i.kind === "section") return "";
    if (i.closed) return i.closeDate != null ? `<span class="flag">закрыто ${fmt(i.closeDate)}</span>` : `<span class="flag">закрыто, дата не указана</span>`;
    if (i.overdue) return `<span class="flag overdue">просрочено ${i.overdueDays} дн.</span>`;
    if (i.soon) return `<span class="flag soon">${esc(E.remainText(i.remain))}</span>`;
    return `<span class="flag muted">${esc(E.remainText(i.remain))}</span>`;
  };
  const flagShort = (i) => (i.overdue ? `<span class="flag overdue">−${i.overdueDays} дн.</span>` : i.soon ? `<span class="flag soon">${i.remain === 0 ? "сегодня" : `через ${i.remain} дн.`}</span>` : "");
  const ctrlFlag = (i) => (i.ctrlPassed ? `<span class="flag ctrl">контр. дата ${fmt(i.ctrl).slice(0, 5)} прошла</span>` : "");
  const chainNo = (num) => { const k = M.chainNums.indexOf(num); return k >= 0 ? `Ц${k + 1}` : num === C.FEEDER.from ? "ПВ" : ""; };
  const owners = (i) => i.owners.map((o) => `<span class="org">${esc(o)}</span>`).join(" ");
  const sectionOf = (num) => { const p = num.split("."); return p[0] === "2" ? p.slice(0, 2).join(".") : p[0]; };
  const matchesFilters = (i) => {
    const f = S.filters;
    if (f.owner && !i.owners.includes(f.owner)) return false;
    if (f.section && sectionOf(i.num) !== f.section && !(f.section === "2" && i.num.startsWith("2."))) return false;
    if (f.search) {
      const s = f.search.toLowerCase().trim();
      if (!(i.num.startsWith(s) || i.num === s.replace(/\.$/, "") || i.name.toLowerCase().includes(s))) return false;
    }
    return orgMatch(i);
  };
  const anyFilter = () => S.filters.owner || S.filters.section || S.filters.search;

  // ── Шкала времени этапа
  const D0 = E.dn("2026-08-13"), D1 = E.dn("2027-02-02");
  const xp = (n) => ((Math.min(Math.max(n, D0), D1) - D0) / (D1 - D0)) * 100;
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const monthStarts = () => {
    const out = [];
    for (let y = 2026, m = 8; y < 2027 || m <= 1; m++) {
      if (m > 11) { m = 0; y++; }
      const n = Date.UTC(y, m, 1) / 86400000;
      if (n > D0 && n < D1) out.push({ n, label: MONTHS[m] + (m === 0 ? " 2027" : "") });
      if (y === 2027 && m === 1) break;
    }
    return out;
  };
  const MS = SEED.milestones.map((m) => ({ n: E.dn(m.date), title: m.title, date: m.date }));
  const MS_SHORT = { "2026-09-30": "Закрытие 3 кв.", "2026-11-30": "Демонстрация ЛО", "2026-12-30": "Окончание этапа", "2027-02-01": "Акт сдачи-приёмки" };

  // ── Шапка
  function renderHeader() {
    const tabs = viewsAvail.map(([k, t]) => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${k === view}" aria-controls="main" tabindex="${k === view ? 0 : -1}" data-view="${k}" data-k="tab-${k}">${t}</button>`).join("");
    return `<header class="top">
      <div class="brand">Орбита · ЯМГ-ИИМ · Этап 1 <span>· ООО «СП «Квант»</span></div>
      <nav class="tabs" role="tablist" aria-label="Режимы отображения">${tabs}</nav>
      <div class="spacer"></div>
      <div class="today">Сегодня <b class="mono">${fmt(T)}</b>${todayFromLink ? ' <span class="note">(задано ссылкой)</span>' : ""}</div>
      <button class="iconbtn theme" data-act="theme" data-k="theme" aria-label="${theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}" title="${theme === "dark" ? "Светлая тема" : "Тёмная тема"}">${ico(theme === "dark" ? "sun" : "moon")}</button>
    </header>`;
  }
  function renderBanners() {
    let h = "";
    if (orgKey) h += `<div class="banner" role="status">Представление для исполнителя: <b>${esc(orgName)}</b>. Только просмотр.</div>`;
    else if (exec) h += `<div class="banner" role="status">Режим для руководства: только просмотр.</div>`;
    notices.forEach((n) => { h += `<div class="banner warn" role="alert">${ico("alert")} ${esc(n)}</div>`; });
    return h;
  }

  // ── Панель инструментов (фильтры)
  function toolbar(extra = "", opts = {}) {
    const ownerOpts = ["Электроприбор", "СП «Квант»", "ФТИ им. Иоффе", "ИХС им. Гребенщикова"].filter((o) => !orgKey || o === orgName);
    const secOpts = [["1", "1 · Запуск"], ["2.1", "2.1 · 3 квартал 2026 года"], ["2.2", "2.2 · 4 квартал 2026 года"], ["3", "3 · Сдача этапа 1"]];
    return `<div class="toolbar" role="search">
      ${orgKey ? "" : `<label class="field">Исполнитель <select data-f="owner" data-k="f-owner"><option value="">Все</option>${ownerOpts.map((o) => `<option ${S.filters.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`}
      <label class="field">Раздел <select data-f="section" data-k="f-section"><option value="">Все</option>${secOpts.map(([v, t]) => `<option value="${v}" ${S.filters.section === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="field">${ico("search")}<span class="sr">Поиск по номеру или наименованию</span><input type="search" data-f="search" data-k="f-search" placeholder="Номер или наименование" value="${esc(S.filters.search)}"></label>
      ${anyFilter() ? `<button class="btn link" data-act="reset-filters" data-k="reset-f">Сбросить фильтр</button>` : ""}
      <div class="spacer"></div>${extra}
    </div>`;
  }
  const emptyFiltered = () => `<div class="empty" role="status"><p>Нет позиций, соответствующих фильтру. Измените условия или сбросьте фильтр.</p><button class="btn" data-act="reset-filters" data-k="reset-f2">Сбросить фильтр</button></div>`;

  // ── СВОДКА (В1 «Панель»)
  function kpiTiles(compact) {
    const k = M.kpi;
    const cls = compact ? "kpi" : "kpi";
    const t = (id, lbl, val, sub, act, alarm) => `<button class="${cls}${alarm ? " alarm" : ""}" data-act="${act}" data-k="kpi-${id}"><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="sub">${sub}</span></button>`;
    const ctrlOnly = M.base.filter((i) => i.ctrlPassed && !i.overdue).length;
    const demo = k.toDemo >= 0 ? `${k.toDemoWd} <small>раб. дн.</small>` : `<small>демонстрация прошла</small>`;
    return [
      t("closed", "Закрыто", `${k.closed} <small>из ${k.base} · ${k.pct} %</small>`, k.noReq ? `из них без реквизита: ${k.noReq}` : "все с реквизитом документа", "go-board"),
      t("plan", "План на дату", `${k.reachedClosed} <small>из ${k.reached}</small>`, `срок наступил у ${k.reached}: закрыто ${k.reachedClosed}, просрочено ${k.overdue}; досрочно закрыто ${k.early}`, "go-overdue"),
      t("overdue", "Просрочено", `${k.overdue}`, ctrlOnly ? `ещё у ${ctrlOnly} прошла контрольная дата` : k.overdue ? "по сроку План-графика" : "просроченных позиций нет", "go-overdue", k.overdue > 0),
      t("demo", "До демонстрации ЛО", demo, k.toDemo >= 0 ? `30.11.2026 · ${k.toDemo} дн.` : "30.11.2026", "go-chain"),
      t("end", "До окончания этапа", k.toEnd >= 0 ? `${k.toEnd} <small>дн.</small>` : `<small>этап завершён</small>`, "30.12.2026 · Акт сдачи-приёмки 01.02.2027", "go-ms"),
    ].join("");
  }
  function timelineStrip() {
    // недельная плотность сроков BASE
    const weeks = new Map();
    M.base.forEach((i) => {
      const wd = (new Date(i.due * 86400000).getUTCDay() + 6) % 7, wk = i.due - wd;
      const w = weeks.get(wk) || { closed: 0, overdue: 0, open: 0, list: [] };
      w[i.closed ? "closed" : i.overdue ? "overdue" : "open"]++; w.list.push(i.num); weeks.set(wk, w);
    });
    let h = `<div class="tl" role="img" aria-label="Сроки позиций по неделям этапа с 13.08.2026 по 01.02.2027, вехи и линия «Сегодня»">`;
    weeks.forEach((w, wk) => {
      const segs = [];
      for (let k = 0; k < w.closed; k++) segs.push('<i class="closed"></i>');
      for (let k = 0; k < w.overdue; k++) segs.push('<i class="overdue"></i>');
      for (let k = 0; k < w.open; k++) segs.push('<i class="open"></i>');
      h += `<span class="tl-bar" style="left:calc(${xp(wk + 3)}% - 4px)" title="Неделя с ${fmt(wk)}: ${w.list.length} поз. (${w.list.join(", ")})">${segs.join("")}</span>`;
    });
    h += `<div class="tl-axis"></div>`;
    monthStarts().forEach((m) => { h += `<span class="tl-mtick" style="left:${xp(m.n)}%"></span>` + (xp(m.n) < 94 ? `<span class="tl-month" style="left:${xp(m.n)}%"><span class="l">${m.label}</span><span class="s">${m.label.slice(0, 3)}</span></span>` : ""); });
    MS.forEach((m) => {
      h += `<span class="tl-ms${m.n < T ? " past" : ""}" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(m.title)}"></span>`;
      if (MS_SHORT[m.date]) {
        const edge = xp(m.n) > 94 ? "transform:translateX(-100%)" : xp(m.n) < 6 ? "transform:none" : "";
        h += `<span class="tl-mslbl" style="left:${xp(m.n)}%;${edge}"><b class="mono">${fmt(m.n).slice(0, 5)}</b> ${MS_SHORT[m.date]}</span>`;
      }
    });
    if (T >= D0 && T <= D1) h += `<div class="tl-today" style="left:${xp(T)}%"><span>Сегодня</span></div>`;
    h += `</div><div class="legend" aria-hidden="true"><span><i style="background:var(--st-closed)"></i>закрыто</span><span><i style="background:var(--st-overdue)"></i>просрочено</span><span><i style="background:var(--st-future)"></i>предстоит</span><span>◆ веха</span><span>столбик — число позиций со сроком на неделе</span></div>`;
    return h;
  }
  const winText = (w) => {
    if (w.state === "overlap") return { top: `${w.P}`, bot: "по ПГ" };
    if (w.state === "breach") return { top: `${w.R}`, bot: "срыв" };
    if (w.state === "eroding") return { top: `${w.P}→${w.R}`, bot: "" };
    if (w.state === "done") return { top: "✓", bot: "" };
    return { top: `${w.P}`, bot: w.state === "thin" ? "тонк." : "" };
  };
  const stateWord = { eroding: "окно расходуется", breach: "срыв", ok: "в плане", done: "исполнена", overlap: "перекрытие по ПГ", thin: "тонкое окно" };
  function chainSentence() {
    const parts = [];
    const all = M.chainWindows.concat([M.feeder]);
    const breaches = all.filter((w) => w.state === "breach");
    const depth = (w) => Math.min(w.P, 0) - w.R;
    if (breaches.length > 2) {
      const worst = breaches.reduce((a, w) => (depth(w) > depth(a) ? w : a));
      parts.push(`Срыв в ${breaches.length} окнах из ${all.length}; наибольший — ${worst.from} → ${worst.to}: ${depth(worst)} раб. дн.`);
    } else breaches.forEach((w) => parts.push(`Окно ${w.from} → ${w.to}: срыв ${depth(w)} раб. дн.`));
    all.filter((w) => w.state === "eroding").forEach((w) => parts.push(`Окно ${w.from} → ${w.to}: осталось ${w.R} из ${w.P} раб. дн.${w.breachFrom ? `; срыв с ${fmt(w.breachFrom)}` : ""}.`));
    const ov = M.chainWindows.filter((w) => w.state === "overlap");
    if (ov.length) parts.push(`Перекрытия ${ov.map((w) => `${w.from} → ${w.to} (${w.P})`).join(", ")} раб. дн. заложены в План-графике.`);
    if (!parts.length) parts.push("Все окна цепочки в плане.");
    return parts.join(" ");
  }
  function chainThread(big) {
    let h = `<div class="chain" role="list" aria-label="Звенья критической цепочки лабораторного образца">`;
    M.chainNums.forEach((n, k) => {
      const i = M.by[n];
      const cls = i.closed ? "closed" : i.overdue ? "overdue" : "";
      if (big) {
        h += `<button class="cnode big ${cls}" role="listitem" data-open="${n}" data-k="cn-${n}">
          <span class="chainmark">Ц${k + 1}</span><span class="n">${n}</span>
          <span class="clamp2 nm">${esc(i.name)}</span>
          <span class="muted">${esc(i.owners.join(", "))}</span>
          <span>Срок <b class="mono">${fmt(i.due)}</b></span>
          <span class="note">прогноз не ранее <span class="mono">${fmt(M.F[n])}</span></span>
          ${statusBadge(i, true)}${flagDue(i)}
        </button>`;
      } else {
        h += `<button class="cnode ${cls}" role="listitem" data-open="${n}" data-k="cn-${n}" title="${esc(i.name)}">
          <span class="n">${n}</span><span class="mono note">${fmt(i.due).slice(0, 5)}</span>${i.overdue ? `<span class="flag overdue">−${i.overdueDays} дн.</span>` : i.closed ? `<span class="flag">закрыто</span>` : i.soon ? `<span class="flag soon">${i.remain} дн.</span>` : `<span class="flag muted">в плане</span>`}
        </button>`;
      }
      const w = M.chainWindows[k];
      if (w) {
        const t = winText(w);
        h += `<div class="cwin ${w.state}" role="listitem" aria-label="Окно ${w.from} — ${w.to}: ${stateWord[w.state]}, план ${w.P}, прогноз ${w.R} рабочих дней"><b>${t.top}</b><span class="line"></span><span class="note">${t.bot}</span></div>`;
      }
    });
    h += `</div>`;
    const f = M.feeder;
    h += `<p class="note" style="margin:var(--sp-2) 0 0">Питающая ветвь: <button class="btn link" data-open="${f.from}" data-k="cn-f">${f.from}</button> ПМИ → ${f.to}: окно ${f.state === "eroding" || f.state === "breach" ? `${f.P} → ${f.R}` : f.P} раб. дн. — ${stateWord[f.state]}.</p>`;
    return h;
  }
  const chainStateBadge = () => `<span class="cstate ${M.chainState}">${M.chainState === "eroding" ? "Окно расходуется" : M.chainState === "breach" ? "Срыв" : M.chainState === "done" ? "Исполнена" : "В плане"}</span>`;
  const whyText = (t) => {
    const i = t.item;
    if (t.why === "chain-overdue" || t.why === "overdue") return `<span class="flag overdue">просрочено ${i.overdueDays} дн.</span>`;
    if (t.why === "ctrl") return `<span class="flag ctrl">контр. дата прошла ${i.ctrlDays} дн.</span>`;
    return `<span class="flag soon">срок ${esc(E.remainText(i.remain))}</span>`;
  };
  function top5() {
    if (!M.top5.length) {
      const allClosed = M.work.every((i) => i.closed);
      return `<p class="muted">${allClosed ? "Рисков нет: все позиции закрыты." : "Просроченных позиций и позиций со сроком до 7 дней нет."}</p>`;
    }
    return `<ol class="list top5">${M.top5.map((t) => `<li><button class="lrow" data-open="${t.item.num}" data-k="r-${t.item.num}"><span class="mono">${t.item.num}${M.chainSet.has(t.item.num) ? ` <span class="chainmark">${chainNo(t.item.num)}</span>` : ""}</span><span class="ellip">${esc(t.item.name)}</span>${whyText(t)}</button></li>`).join("")}</ol>`;
  }
  function sectionsBlock() {
    return M.sections.map((s) => `<button class="secrow" data-act="go-section" data-sec="${s.num}" data-k="sec-${s.num}">
      <span class="ellip"><span class="mono">${s.num}</span> ${esc(s.name)}</span>
      <span class="prog" role="img" aria-label="Закрыто ${s.closed} из ${s.total}"><i style="width:${(s.closed / s.total) * 100}%"></i></span>
      <span>закрыто <b>${s.closed}</b> из ${s.total}</span>
      <span class="${s.overdue ? "flag overdue" : "muted"}">${s.overdue ? `просрочено ${s.overdue}` : "просрочек нет"}</span></button>`).join("");
  }
  function viewSummary() {
    if (VARIANT === "path") return viewSummaryPath();
    return `<div class="page">
      <h1 class="sr">Сводка по этапу 1 ОКР «ЯМГ-ИИМ»</h1>
      <section class="kpis" aria-label="Ключевые показатели">${kpiTiles()}</section>
      <section class="card" aria-labelledby="h-tl"><h2 id="h-tl">Сроки этапа <span class="note">13.08.2026 – 01.02.2027 · база показателей: ${M.kpi.base} позиций с обязательством перед Заказчиком</span></h2>${timelineStrip()}</section>
      <div class="grid2">
        <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Критическая цепочка ЛО ${chainStateBadge()}<span class="note">окна — рабочие дни</span><span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">Открыть в Ганте</button></h2>
          ${chainThread(false)}<p style="margin:var(--sp-2) 0 0">${esc(chainSentence())}</p></section>
        <section class="card" aria-labelledby="h-r"><h2 id="h-r">Топ-5 рисков <span class="note">просроченные и ≤ 7 дней, сначала цепочка ЛО</span></h2>${top5()}</section>
      </div>
      <section class="card" aria-labelledby="h-s"><h2 id="h-s">Прогресс по разделам <span class="note">закрыто из позиций базы показателей</span></h2><div style="display:grid;gap:var(--sp-1)">${sectionsBlock()}</div></section>
    </div>`;
  }
  // ── СВОДКА (В3 «Путь к ЛО»)
  function viewSummaryPath() {
    const k = M.kpi;
    return `<div class="page">
      <h1 class="sr">Путь к демонстрации лабораторного образца</h1>
      <section class="card pathhead" aria-label="Итог">
        <div class="pathtitle">До демонстрации ЛО <b class="mono">30.11.2026</b> — ${k.toDemo >= 0 ? `<b>${k.toDemoWd}</b> раб. дн. (${k.toDemo} дн.)` : "демонстрация прошла"}</div>
        ${chainStateBadge()}<span class="muted">${esc(chainSentence())}</span>
      </section>
      <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Критическая цепочка: 8 звеньев <span class="note">окна — рабочие дни «план → прогноз»; прогноз — «не ранее»</span><span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">Открыть в Ганте</button></h2>${chainThread(true)}</section>
      <div class="grid3">
        <section class="card" aria-labelledby="h-r"><h2 id="h-r">Топ-5 рисков</h2>${top5()}</section>
        <section class="kpicol" aria-label="Ключевые показатели">${kpiTiles().split("</button>").slice(0, 3).join("</button>")}</button></section>
      </div>
    </div>`;
  }

  // ── ГАНТ
  function ganttRows() {
    const items = M.items;
    const vis = new Set();
    const slice = S.slice;
    const pass = (i) => i.kind !== "section" && matchesFilters(i) && (slice === "all" || (slice === "overdue" && i.overdue) || (slice === "chain" && M.chainSet.has(i.num)));
    const filtering = anyFilter() || slice !== "all" || orgKey;
    items.forEach((i) => {
      if (filtering ? pass(i) : true) {
        vis.add(i.num);
        let p = i.parent; while (p) { vis.add(p); p = M.by[p].parent; }
      }
    });
    const hidden = (i) => { let p = i.parent; while (p) { if (S.collapsed.has(p)) return true; p = M.by[p].parent; } return false; };
    return items.filter((i) => vis.has(i.num) && !hidden(i));
  }
  function ganttAxis() {
    let h = `<div class="axis">`;
    monthStarts().forEach((m) => { h += `<span class="m" style="left:${xp(m.n)}%">${m.label}</span>`; });
    for (let n = D0; n <= D1; n++) if (new Date(n * 86400000).getUTCDay() === 1) h += `<span class="w" style="left:${xp(n)}%"></span>`;
    MS.forEach((m) => { h += `<span class="msd" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(m.title)}"></span>`; });
    if (T >= D0 && T <= D1) h += `<span class="todaylbl" style="left:${xp(T)}%">Сегодня ${fmt(T).slice(0, 5)}</span><span class="todayline" style="left:${xp(T)}%;top:auto;height:12px;bottom:0"></span>`;
    return h + `</div>`;
  }
  const monthLines = () => monthStarts().map((m) => `<span class="gm" style="left:${xp(m.n)}%"></span>`).join("");
  function barCell(i) {
    const bg = `<div class="grid-bg">${monthLines()}</div>` + (T >= D0 && T <= D1 ? `<span class="todayline" style="left:${xp(T)}%"></span>` : "");
    if (i.kind === "section") {
      return bg + `<span class="bar" style="left:${xp(i.start)}%;width:${xp(i.due) - xp(i.start)}%;height:2px;margin-top:-1px;background:var(--border-strong)"></span>`;
    }
    const l = xp(i.start), r = xp(i.due + 1), w = Math.max(r - l, 0.3);
    const derW = i.s.start_derived ? Math.min(w * 0.4, (14 / (D1 - D0)) * 100) : 0;
    const chain = showChain && M.chainSet.has(i.num);
    let h = bg;
    const isGroup = i.kind === "group";
    h += `<span class="bar ${i.cls}${isGroup ? " group" : ""}${chain ? " chain" : ""}" style="left:${l}%;width:${w}%">`;
    if (derW && !isGroup) h += `<span class="der" style="width:${(derW / w) * 100}%"></span>`;
    if (isGroup) h += `<span class="gp" style="width:${(i.progress.closed / i.progress.total) * 100}%"></span>`;
    if (i.closed) h += `<span class="ok">${ico("check")}</span>`;
    h += `</span>`;
    if (i.overdue) h += `<span class="od" style="left:${r}%;width:${Math.max(xp(T) - r, 0.3)}%"></span>`;
    if (i.ctrl != null && !i.closed) h += `<span class="ctl" style="left:${xp(i.ctrl)}%" title="Контрольная дата ${fmt(i.ctrl)}"></span>`;
    if (chain) {
      const k = M.chainNums.indexOf(i.num);
      const lblX = Math.max(i.overdue ? xp(T) : r, r) + (i.closed ? 2.2 : 0.6);
      h += `<span class="clabel" style="left:${lblX}%">${chainNo(i.num)}</span>`;
      const w0 = k > 0 ? M.chainWindows[k - 1] : i.num === C.FEEDER.to ? null : null;
      if (w0) {
        const a = xp(M.by[w0.from].due + 1), b = xp(i.due + 1);
        h += `<span class="bracket ${w0.state}" style="left:${Math.min(a, b)}%;width:${Math.abs(b - a)}%" title="Окно ${w0.from} → ${w0.to}: ${stateWord[w0.state]}, план ${w0.P}, прогноз ${w0.R} раб. дн."></span>`;
      }
    }
    return h;
  }
  function ganttSr(i) {
    if (i.kind === "section") return `Раздел ${i.num}, срок ${fmt(i.due)}`;
    return `Срок ${fmt(i.due)}; ${i.closed ? "закрыто" : i.overdue ? `просрочено ${i.overdueDays} дн.` : E.remainText(i.remain)}${i.ctrl != null ? `; контрольная дата ${fmt(i.ctrl)}` : ""}${showChain && M.chainSet.has(i.num) ? "; звено критической цепочки" : ""}`;
  }
  function ganttStrip() {
    if (VARIANT !== "registry" || orgKey) return "";
    return `<section class="gstrip" aria-label="Ключевые показатели">${kpiTiles(true)}</section>`;
  }
  function viewGantt() {
    const rows = ganttRows();
    const sliceSeg = `<div class="seg" role="group" aria-label="Срез">${[["all", "Все"], ["overdue", "Просроченные"]].concat(showChain ? [["chain", "Цепочка ЛО"]] : []).map(([k, t]) => `<button aria-pressed="${S.slice === k}" data-slice="${k}" data-k="sl-${k}">${t}</button>`).join("")}</div>
      <button class="btn" data-act="collapse-all" data-k="col-all">Свернуть разделы</button><button class="btn" data-act="expand-all" data-k="exp-all">Развернуть</button>`;
    const hasItems = rows.some((i) => i.kind !== "section");
    let body = "";
    if (!hasItems) body = `<tr><td colspan="6">${emptyFiltered()}</td></tr>`;
    else rows.forEach((i) => {
      const isSec = i.kind === "section", canCol = isSec || i.kind === "group";
      const exp = !S.collapsed.has(i.num);
      const ctxOnly = orgKey && !i.owners.includes(orgName) && !isSec;
      body += `<tr class="${isSec ? "sec" : ""}${S.selected === i.num ? " sel" : ""}" data-open="${i.num}" tabindex="0" data-k="row-${i.num}" aria-level="${i.level}" ${canCol ? `aria-expanded="${exp}"` : ""}>
        <td class="num">${i.num}</td>
        <td><div class="nm ind${i.level}">${canCol ? `<button class="chev" data-toggle="${i.num}" aria-expanded="${exp}" aria-label="${exp ? "Свернуть" : "Развернуть"} ${i.num}" data-k="tg-${i.num}">${ico("chev")}</button>` : `<span style="width:20px;flex:none"></span>`}<span class="t" title="${esc(i.name)}">${esc(i.name)}</span>${i.kind === "group" && !ctxOnly ? `<span class="note">${i.progress.closed}/${i.progress.total}</span>` : ""}</div></td>
        <td class="ellip muted" title="${esc(i.s.owner_raw || "")}">${isSec ? "" : esc(i.owners.join(", "))}</td>
        <td class="due">${isSec ? `<span class="mono muted">${fmt(i.due)}</span>` : `<span class="mono">${fmt(i.due)}</span>${ctxOnly || i.closed ? "" : flagShort(i)}`}</td>
        <td>${isSec || ctxOnly ? "" : statusBadge(i, true)}</td>
        <td class="tlcell"><span class="sr">${esc(ganttSr(i))}</span><div aria-hidden="true" style="position:absolute;inset:0">${ctxOnly ? "" : barCell(i)}</div></td>
      </tr>`;
    });
    const mlist = mobileList(rows);
    return `${ganttStrip()}${toolbar(sliceSeg)}
      <div class="gwrap${VARIANT === "registry" && !orgKey ? " withstrip" : ""}">
        <table class="gantt" aria-label="Гант-реестр позиций План-графика">
          <colgroup><col class="c-num"><col class="c-name"><col class="c-own"><col class="c-due"><col class="c-st"><col></colgroup>
          <thead><tr><th scope="col">№</th><th scope="col">Наименование</th><th scope="col">Исполнитель</th><th scope="col">Срок</th><th scope="col">Статус</th><th scope="col" class="tlcell">${ganttAxis()}</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>${mlist}
      <div class="legend gleg" aria-hidden="true" style="padding:var(--sp-1) var(--sp-3)"><span><i style="background:var(--st-closed)"></i>закрыто ✓</span><span><i style="background:var(--st-progress)"></i>идёт</span><span><i style="background:var(--st-action)"></i>требует действия</span><span><i style="background:var(--surface-3);border:1px solid var(--border-strong)"></i>не начато</span><span><i style="background:repeating-linear-gradient(45deg,var(--st-overdue) 0 2px,transparent 2px 5px)"></i>просрочено</span><span>светлое начало — расчётная дата</span><span>| контр. дата</span><span>линия под группой — закрытые подпозиции</span>${showChain ? "<span>Ц1–Ц8 — цепочка ЛО, ПВ — питающая ветвь, скобка — окно</span>" : ""}</div>`;
  }
  function mobileList(rows) {
    let h = `<div class="mlist" aria-label="Список позиций">`;
    const items = rows.filter((i) => i.kind !== "section");
    if (!items.length) return h + emptyFiltered() + "</div>";
    rows.forEach((i) => {
      if (i.kind === "section") { if (i.level === 1 || i.level === 2) h += `<div class="mhead"><span class="mono">${i.num}</span> ${esc(i.name)}</div>`; return; }
      const ctxOnly = orgKey && !i.owners.includes(orgName);
      h += `<button class="mcard" data-open="${i.num}" data-k="m-${i.num}"><span class="r1"><span class="mono">${i.num}</span><span class="clamp2">${esc(i.name)}</span></span>
        <span class="r2"><span class="mono">${fmt(i.due)}</span>${ctxOnly ? "" : flagDue(i) + statusBadge(i, true)}${showChain && M.chainSet.has(i.num) ? `<span class="chainmark">${chainNo(i.num)}</span>` : ""}</span></button>`;
    });
    return h + "</div>";
  }

  // ── ФОКУС
  function viewFocus() {
    const list = M.work.filter((i) => matchesFilters(i) && (!orgKey || i.owners.includes(orgName)));
    const lanes = [["overdue", "Просрочено"], ["h14", "Ближайшие 14 дней"], ["h30", "30 дней"], ["h60", "60 дней"], ["later", "Позднее 60 дней"], ["closed", "Закрыто"]];
    const agendaBtn = readonly ? "" : `<button class="btn primary" data-act="agenda" data-k="agenda">${ico("file")} Повестка оперативки</button>`;
    let h = toolbar(agendaBtn) + `<div class="page"><h1 class="sr">Фокус периода</h1>`;
    if (!list.length) h += emptyFiltered();
    lanes.forEach(([k, t]) => {
      const rows = list.filter((i) => i.horizon === k).sort((a, b) => a.due - b.due || a.idx - b.idx);
      const offPlan = k === "closed" && !orgKey && !anyFilter() ? SEED.off_plan_closed : [];
      const open = k === "later" || k === "closed" ? S.lanes[k] : true;
      h += `<details class="lane ${k}" ${open ? "open" : ""} data-lane="${k}"><summary data-k="lane-${k}"><span class="chev">${ico("chev")}</span>${t} <span class="cnt">${rows.length + offPlan.length}</span></summary>`;
      if (!rows.length && !offPlan.length) h += `<p class="muted" style="margin:0;padding:var(--sp-2) var(--sp-3)">Позиций в этом горизонте нет.</p>`;
      rows.forEach((i) => {
        h += `<button class="frow" data-open="${i.num}" data-k="f-${i.num}"><span class="mono">${i.num}</span><span class="ellip" title="${esc(i.name)}">${esc(i.name)}</span><span class="own" title="${esc(i.owners.join(", "))}">${esc(i.owners.join(", "))}</span><span class="mono">${fmt(i.due)}</span>${flagDue(i)}<span>${statusBadge(i, true)} ${ctrlFlag(i)}</span></button>`;
      });
      offPlan.forEach((o) => {
        h += `<div class="frow" role="note"><span class="note">вне ПГ</span><span class="ellip" title="${esc(o.name)}">${esc(o.name)}</span><span class="own">${esc(o.owner)}</span><span class="mono">${fmt(E.dn(o.transfer))}</span><span class="flag">передано ${fmt(E.dn(o.transfer))}</span><span><span class="badge closed">${esc(o.mark)}</span> <span class="note">вне План-графика</span></span></div>`;
      });
      h += `</details>`;
    });
    return h + `</div>`;
  }

  // ── ДОСКА
  function viewBoard() {
    const list = M.work.filter((i) => matchesFilters(i) && (!orgKey || i.owners.includes(orgName)));
    let h = toolbar() + `<h1 class="sr">Доска статусов</h1>`;
    if (!list.length) return h + emptyFiltered();
    h += `<div class="board">`;
    E.STATUSES.forEach((st) => {
      const cards = list.filter((i) => i.status === st).sort((a, b) => a.due - b.due || a.idx - b.idx);
      h += `<section class="col" aria-label="${st}: ${cards.length}"><h3><i style="background:var(--st-${E.CLS[st]})"></i>${st}<span class="cnt muted">${cards.length}</span></h3><ul>`;
      if (!cards.length) h += `<li class="muted">Позиций нет.</li>`;
      cards.forEach((i) => {
        h += `<li><button class="bcard${i.overdue ? " overdue" : ""}" data-open="${i.num}" data-k="b-${i.num}"><span class="r"><span class="mono">${i.num}</span>${showChain && M.chainSet.has(i.num) ? `<span class="chainmark">${chainNo(i.num)}</span>` : ""}${i.src === "inherited" ? `<span class="note">по группе ${i.inheritedFrom}</span>` : i.src === "derived" ? `<span class="note">расчётный</span>` : ""}${i.closed && i.noReq ? `<span class="note">без реквизита</span>` : ""}</span>
          <span class="clamp2">${esc(i.name)}</span><span class="r">${owners(i)}</span><span class="r"><span class="mono">${fmt(i.due)}</span>${flagDue(i)}</span>${i.ctrlPassed ? ctrlFlag(i) : ""}</button></li>`;
      });
      h += `</ul></section>`;
    });
    return h + `</div>`;
  }

  // ── ВЕХИ
  function viewMilestones() {
    const list = M.work.filter((i) => matchesFilters(i) && (!orgKey || i.owners.includes(orgName)));
    const clusters = new Map();
    list.forEach((i) => { const c = clusters.get(i.due) || []; c.push(i); clusters.set(i.due, c); });
    const keys = [...clusters.keys()].sort((a, b) => a - b);
    if (S.msDate == null || !clusters.has(S.msDate)) {
      const near = keys.filter((d) => d >= T && d - T <= 14);
      S.msDate = near.length ? near.reduce((a, d) => (clusters.get(d).length > clusters.get(a).length ? d : a), near[0]) : keys.find((d) => d >= T) ?? keys[keys.length - 1] ?? null;
    }
    let h = toolbar() + `<div class="ms-wrap"><h1 class="sr">Хронология вех</h1>`;
    if (!list.length) return h + emptyFiltered() + "</div>";
    const peak = Math.max(...keys.map((d) => clusters.get(d).length));
    h += `<section class="card"><h2>Вехи и грозди сроков <span class="note">столбик — позиции со сроком в этот день (квадрат — одна позиция); выберите столбик, чтобы увидеть позиции</span></h2><div class="ms-scroll"><div class="ms-canvas">`;
    monthStarts().forEach((m) => { if (xp(m.n) < 96) h += `<span class="ms-month" style="left:${xp(m.n)}%">${m.label}</span>`; });
    h += `<div class="ms-axis"></div>`;
    keys.forEach((d) => {
      const c = clusters.get(d);
      const cl = c.filter((i) => i.closed).length;
      const sq = c.map((i) => `<i class="${i.overdue ? "overdue" : i.cls}"></i>`).join("");
      h += `<button class="ms-cl" style="left:${xp(d)}%" aria-pressed="${S.msDate === d}" data-ms="${d}" data-k="ms-${d}" title="${fmt(d)}: ${c.length} поз." aria-label="${fmt(d)}: ${c.length} ${E.plural(c.length, "позиция", "позиции", "позиций")}, из них закрыто ${cl}">${sq}</button>`;
      if (c.length >= 5 || c.length === peak) h += `<span class="ms-cn" style="left:${xp(d)}%;bottom:${60 + c.length * 10 + 4}px"><span class="mono">${fmt(d).slice(0, 5)}</span> · ${c.length}</span>`;
    });
    MS.forEach((m, k) => {
      h += `<span class="ms-d${m.n < T ? " past" : ""}" style="left:${xp(m.n)}%" title="${fmt(m.n)} — ${esc(m.title)}"></span><span class="ms-dn mono" style="left:${xp(m.n)}%;top:${k % 2 ? 222 : 206}px">${k + 1}</span>`;
    });
    if (T >= D0 && T <= D1) h += `<div class="ms-today" style="left:${xp(T)}%"><span>Сегодня</span></div>`;
    h += `</div></div>`;
    // перечень вех: номер, дата, наименование; для вех-сроков — вычисленное число позиций
    h += `<ol class="ms-legend">${MS.map((m, k) => {
      const c = clusters.get(m.n);
      return `<li><span class="ms-num mono">${k + 1}</span><span class="mono">${fmt(m.n)}</span><span>${esc(m.title)}${c ? ` <span class="note">· со сроком в этот день: ${c.length}, закрыто ${c.filter((i) => i.closed).length}</span>` : ""}</span></li>`;
    }).join("")}</ol>`;
    // мобильный вертикальный список
    h += `<div class="ms-mlist"><ul class="list">`;
    keys.forEach((d) => {
      const c = clusters.get(d);
      h += `<li><button class="lrow" data-ms="${d}" data-k="msm-${d}" aria-pressed="${S.msDate === d}"><span class="mono">${fmt(d)}</span><span>${c.length} ${E.plural(c.length, "позиция", "позиции", "позиций")}</span><span class="note">закрыто ${c.filter((i) => i.closed).length}</span></button></li>`;
    });
    h += `</ul></div></section>`;
    const sel = S.msDate != null ? clusters.get(S.msDate) : null;
    if (sel) {
      h += `<section class="card"><h2>Срок ${fmt(S.msDate)} <span class="note">${sel.length} ${E.plural(sel.length, "позиция", "позиции", "позиций")}</span></h2><ul class="list">${sel.map((i) => `<li><button class="lrow" data-open="${i.num}" data-k="msl-${i.num}"><span class="mono">${i.num}</span><span class="ellip">${esc(i.name)}</span><span>${statusBadge(i, true)} ${flagDue(i)}</span></button></li>`).join("")}</ul></section>`;
    }
    return h + `</div>`;
  }

  // ── БОКОВАЯ ПАНЕЛЬ
  function renderPanel() {
    const i = S.selected && M.by[S.selected];
    if (!i) return `<aside class="panel" hidden></aside>`;
    const ctxOnly = orgKey && !i.owners.includes(orgName);
    const dl = (rows) => `<dl>${rows.filter((r) => r[1] != null && r[1] !== "").map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
    let h = `<aside class="panel" role="dialog" aria-modal="false" aria-labelledby="p-title">
      <header><h2 id="p-title" tabindex="-1" title="${esc(i.name)}"><span class="mono">${i.num}</span>${esc(i.name)}</h2><button class="iconbtn" data-act="close-panel" data-k="p-close" aria-label="Закрыть панель позиции">${ico("x")}</button></header><div class="body">`;
    if (i.kind === "section") {
      h += `<p class="muted">Раздел План-графика. Сроки раздела вычислены по вложенным позициям.</p>` + dl([["Период", `<span class="mono">${fmt(i.start)} – ${fmt(i.due)}</span>`]]);
      return h + `</div></aside>`;
    }
    if (!ctxOnly) {
      h += `<section><h3>Статус</h3><p>${statusBadge(i, false)} ${flagDue(i)} ${ctrlFlag(i)}</p>`;
      if (i.src === "inherited") h += `<p class="note">Отметки по подпозиции нет; показан статус группы ${i.inheritedFrom} (Р-12).</p>`;
      if (i.src === "derived") h += `<p class="note">Статус группы в данных не задан; вычислен по подпозициям (Р-14).</p>`;
      if (i.kind === "group") h += `<p class="note">Подпозиции: закрыто ${i.progress.closed} из ${i.progress.total}.</p>`;
      if (!readonly) {
        h += `<div class="stseg" role="group" aria-label="Сменить статус">${E.STATUSES.map((st) => `<button aria-pressed="${(S.closeForm && S.closeForm.num === i.num ? "Закрыто" : i.status) === st}" data-status="${st}" data-k="st-${st}">${st}</button>`).join("")}</div>`;
        if (S.closeForm && S.closeForm.num === i.num) {
          const f = S.closeForm, noName = !f.name.trim();
          h += `<div class="form" style="margin-top:var(--sp-2)"><b>Реквизит выдаваемого документа</b>
            <label>Наименование документа<input data-cf="name" data-k="cf-name" value="${esc(f.name)}"></label>
            <label>№ письма<input data-cf="letter" data-k="cf-letter" value="${esc(f.letter)}"></label>
            <label>Дата (ДД.ММ.ГГГГ)<input inputmode="numeric" data-cf="date" data-k="cf-date" value="${esc(f.date)}" aria-invalid="${f.dateBad ? "true" : "false"}" aria-describedby="cf-date-err"></label>${f.dateBad ? `<span id="cf-date-err" class="flag overdue" role="alert">Укажите дату в формате ДД.ММ.ГГГГ, например ${fmt(T)}.</span>` : ""}
            ${noName ? `<div class="warnbox" role="alert">${ico("alert")}<span>Позиция будет закрыта без реквизита выдаваемого документа.</span></div>` : ""}
            <div class="actions"><button class="btn primary" data-act="do-close" data-k="cf-do">${noName ? "Закрыть без реквизита" : "Закрыть позицию"}</button><button class="btn" data-act="cancel-close" data-k="cf-cancel">Отменить</button></div></div>`;
        }
        if (edits[i.num]) h += `<p><button class="btn link" data-act="reset-one" data-k="p-reset">${ico("reset")} Вернуть исходные данные позиции</button></p>`;
      }
      h += `</section>`;
    }
    h += `<section><h3>Сроки</h3>${dl([
      ["Срок завершения (План-график)", `<span class="mono">${fmt(i.due)}</span>${i.s.due_qualifier ? ` (${esc(i.s.due_qualifier)})` : ""}`],
      ["Срок предоставления Заказчику", i.dueCust != null ? `<span class="mono">${fmt(i.dueCust)}</span>${i.s.due_to_customer_qualifier ? ` (${esc(i.s.due_to_customer_qualifier)})` : ""}` : "—"],
      ["Контрольная дата (оперативка)", i.ctrl != null ? `<span class="mono">${fmt(i.ctrl)}</span>` : null],
      ["Дата закрытия", i.closed ? (i.closeDate != null ? `<span class="mono">${fmt(i.closeDate)}</span>` : "не указана") : null],
      ["Начало", `<span class="mono">${fmt(i.start)}</span> <span class="note">${i.s.start_derived ? "расчётное, только для отображения" : ""}</span>`],
    ])}</section>`;
    if (showChain && M.chainSet.has(i.num) && !ctxOnly) {
      const k = M.chainNums.indexOf(i.num);
      const ws = M.chainWindows.filter((w) => w.from === i.num || w.to === i.num).concat(i.num === C.FEEDER.from || i.num === C.FEEDER.to ? [M.feeder] : []);
      h += `<section><h3>Критическая цепочка ЛО · ${chainNo(i.num)}</h3><p class="note">Прогноз окончания не ранее <span class="mono">${fmt(M.F[i.num])}</span>.</p><ul class="list">${ws.map((w) => `<li>Окно ${w.from} → ${w.to}: план ${w.P}, прогноз ${w.R} раб. дн. — <b>${stateWord[w.state]}</b>${w.breachFrom ? `, срыв с ${fmt(w.breachFrom)}` : ""}</li>`).join("")}</ul>${k < 0 ? "" : ""}</section>`;
    }
    if (i.name.length > 120) h += `<section><h3>Наименование работ, мероприятий (полностью)</h3><p>${esc(i.name)}</p></section>`;
    h += `<section><h3>Исполнитель</h3><p>${esc(i.s.owner_raw || "—")}</p></section>`;
    h += `<section><h3>Документы</h3>${dl([["Представляемые документы", esc(i.s.output_doc || "—")], ["Документ, определяющий исполнение", esc(i.s.execution_doc || "—")]])}</section>`;
    if (i.closed && i.edit && i.edit.closeDoc) {
      const cd = i.edit.closeDoc;
      h += `<section><h3>Реквизит закрытия</h3><p>${cd.name ? esc(cd.name) : "не указан"}${cd.letter ? `, № ${esc(cd.letter)}` : ""}${cd.date ? `, <span class="mono">${fmt(E.dn(cd.date))}</span>` : ""}</p></section>`;
    }
    h += `<section><h3>Основание включения позиции</h3><p>${esc(i.s.basis || "—")}</p></section>`;
    if (i.s.plan_note) h += `<section><h3>Примечание (План-график)</h3><p>${esc(i.s.plan_note)}</p></section>`;
    if (i.s.status_mark) h += `<section><h3>Отметка вкладки «Важное»</h3><p>${esc(i.s.status_mark)}</p></section>`;
    h += `<section><h3>Комментарий руководителя проекта</h3>${readonly ? `<p>${esc(i.comment || "—")}</p>` : `<label class="sr" for="p-comment">Комментарий</label><textarea id="p-comment" data-comment="${i.num}" data-k="p-comment" placeholder="Факты по позиции: документ, дата, договорённость">${esc(i.comment)}</textarea>`}</section>`;
    const links = C.LINKS.filter(([a, b]) => a === i.num || b === i.num);
    if (links.length) h += `<section><h3>Связи с другими позициями</h3><ul class="list">${links.map(([a, b, t]) => `<li>${esc(t)} — <button class="btn link" data-open="${a === i.num ? b : a}" data-k="lk-${a}-${b}">открыть ${a === i.num ? b : a}</button></li>`).join("")}</ul></section>`;
    return h + `</div></aside>`;
  }

  // ── Окно повестки
  function renderAgenda() {
    if (!S.agendaOpen) return "";
    const a = E.agenda(M);
    return `<div class="modal-back" data-act="close-agenda-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ag-title">
      <header><h2 id="ag-title">Повестка оперативки на ${fmt(T)}</h2><button class="iconbtn" data-act="close-agenda" data-k="ag-x" aria-label="Закрыть окно повестки">${ico("x")}</button></header>
      <p class="note" style="margin:var(--sp-2) var(--sp-3) 0">Формат строки: «Наименование — комментарий (п. N)». Комментарий — текст руководителя, при его отсутствии — отметка вкладки «Важное». Позиций: просрочено ${a.counts[0]}, контрольная дата прошла ${a.counts[1]}, срок в 14 дней ${a.counts[2]}.</p>
      <label class="sr" for="ag-text">Текст повестки</label><textarea id="ag-text" readonly data-k="ag-text">${esc(a.text)}</textarea>
      <footer><span class="note" id="ag-status" role="status"></span><button class="btn primary" data-act="copy-agenda" data-k="ag-copy">${ico("copy")} Скопировать</button><button class="btn" data-act="close-agenda" data-k="ag-close">Закрыть</button></footer></div></div>`;
  }

  // ── Полная отрисовка
  const root = document.getElementById("app");
  function render() {
    const act = document.activeElement;
    const fk = act && act.getAttribute && act.getAttribute("data-k");
    const sel = act && "selectionStart" in act ? [act.selectionStart, act.selectionEnd] : null;
    const scrollers = [...document.querySelectorAll(".gwrap,.board,.panel .body,.ms-scroll")].map((e) => [e.className, e.scrollTop, e.scrollLeft]);
    recompute();
    let main;
    try {
      main = { summary: viewSummary, gantt: viewGantt, focus: viewFocus, board: viewBoard, milestones: viewMilestones }[view]();
    } catch (err) {
      console.error(err);
      main = `<div class="empty" role="alert"><p>Не удалось построить отображение режима. Обновите страницу; если ошибка повторится, сообщите руководителю проекта.</p></div>`;
    }
    root.innerHTML = `<a class="skip" href="#main">Перейти к содержанию</a>${renderHeader()}${renderBanners()}
      <main id="main" role="tabpanel" aria-labelledby="tab-${view}" tabindex="-1">${main}</main>
      <footer class="foot"><span>Источник: План-график этапа 1 (вкладки «На подписание» и «Важное»), редакция на 28.09.2026. Даты начала — расчётные.</span>
      <span>Рабочие дни — по производственному календарю РФ.</span>${!store.ok ? "<span>Отметки хранятся только до перезагрузки страницы.</span>" : ""}
      ${!readonly && Object.keys(edits).length ? `<button class="btn link" data-act="reset-all" data-k="reset-all">Сбросить все отметки (${Object.keys(edits).length})</button>` : ""}</footer>
      ${renderPanel()}${renderAgenda()}`;
    scrollers.forEach(([cls, t, l]) => { const e = document.getElementsByClassName(cls.split(" ")[0])[0]; if (e) { e.scrollTop = t; e.scrollLeft = l; } });
    if (fk) {
      const el = root.querySelector(`[data-k="${CSS.escape(fk)}"]`);
      if (el) { el.focus({ preventScroll: true }); if (sel && "setSelectionRange" in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* не текстовое поле */ } }
    }
  }
  function setView(v) {
    view = v; S.closeForm = null;
    const u = new URL(location.href);
    if (exec && v !== "summary") u.searchParams.delete("view"); else u.searchParams.set("view", exec && v === "summary" ? "exec" : v);
    try { history.replaceState(null, "", u); } catch (e) { /* file:// в некоторых браузерах */ }
    render();
    const t = document.getElementById("tab-" + v); if (t) t.focus();
  }
  function openItem(num, from) {
    S.returnFocus = from && from.getAttribute("data-k");
    S.selected = num; S.closeForm = null; render();
    const h = document.getElementById("p-title"); if (h) h.focus();
  }
  function closePanel() {
    S.selected = null; S.closeForm = null; render();
    if (S.returnFocus) { const el = root.querySelector(`[data-k="${CSS.escape(S.returnFocus)}"]`); if (el) el.focus(); }
  }
  function setEdit(num, patch) {
    const cur = edits[num] || {};
    edits[num] = Object.assign({}, cur, patch);
    Object.keys(edits[num]).forEach((k) => { if (edits[num][k] === undefined) delete edits[num][k]; });
    if (!Object.keys(edits[num]).length) delete edits[num];
    saveEdits();
  }

  // ── События
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
    if (a === "theme") { theme = theme === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", theme); store.set(C.THEME_KEY, theme); return render(); }
    if (a === "reset-filters") { S.filters = { owner: "", section: "", search: "" }; S.slice = "all"; return render(); }
    if (a === "collapse-all") { M.items.filter((i) => i.kind === "section" && i.level <= 2 && i.num !== "2").forEach((i) => S.collapsed.add(i.num)); return render(); }
    if (a === "expand-all") { S.collapsed.clear(); return render(); }
    if (a === "go-overdue") { S.slice = "overdue"; S.filters = { owner: "", section: "", search: "" }; return setView("gantt"); }
    if (a === "go-chain") { S.slice = "chain"; S.filters = { owner: "", section: "", search: "" }; return setView("gantt"); }
    if (a === "go-board") return setView("board");
    if (a === "go-ms") return setView("milestones");
    if (a === "go-section") { S.slice = "all"; S.filters = { owner: "", section: t.dataset.sec, search: "" }; S.collapsed.clear(); return setView("gantt"); }
    if (a === "close-panel") return closePanel();
    if (a === "cancel-close") { S.closeForm = null; return render(); }
    if (a === "do-close") {
      const f = S.closeForm;
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(f.date.trim());
      const isoDate = m && E.parseISO(`${m[3]}-${m[2]}-${m[1]}`) != null ? `${m[3]}-${m[2]}-${m[1]}` : null;
      if (!isoDate) { f.dateBad = true; render(); const d = document.querySelector('[data-k="cf-date"]'); if (d) d.focus(); return; }
      setEdit(f.num, { status: "Закрыто", closeDoc: { name: f.name.trim(), letter: f.letter.trim(), date: isoDate } });
      S.closeForm = null; return render();
    }
    if (a === "reset-one") { delete edits[S.selected]; saveEdits(); S.closeForm = null; return render(); }
    if (a === "reset-all") { edits = {}; saveEdits(); S.closeForm = null; return render(); }
    if (a === "agenda") { S.agendaOpen = true; render(); const c = document.querySelector('[data-k="ag-copy"]'); if (c) c.focus(); return; }
    if (a === "close-agenda" || (a === "close-agenda-bg" && ev.target === t)) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
    if (a === "copy-agenda") {
      const ta = document.getElementById("ag-text"), st = document.getElementById("ag-status");
      const done = () => { st.textContent = "Текст скопирован в буфер обмена."; };
      const manual = () => { ta.focus(); ta.select(); st.textContent = "Автоматическое копирование недоступно: текст выделен, скопируйте его вручную."; };
      try { navigator.clipboard.writeText(ta.value).then(done, manual); } catch (e) { manual(); }
    }
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.f) { S.filters[t.dataset.f] = t.value; render(); }
    else if (t.dataset.cf) { S.closeForm[t.dataset.cf] = t.value; if (t.dataset.cf === "name") render(); }
    else if (t.dataset.comment) { setEdit(t.dataset.comment, { comment: t.value || undefined }); }
  });
  root.addEventListener("change", (ev) => { if (ev.target.dataset.comment) render(); });
  root.addEventListener("toggle", (ev) => { const d = ev.target; if (d.dataset && d.dataset.lane in S.lanes) S.lanes[d.dataset.lane] = d.open; }, true);
  root.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (t.getAttribute("role") === "tab" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
      const tabs = [...root.querySelectorAll('[role="tab"]')], k = tabs.indexOf(t);
      const n = tabs[(k + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); ev.preventDefault(); return;
    }
    if (t.tagName === "TR" && t.dataset.open) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); return openItem(t.dataset.open, t); }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { const s = ev.key === "ArrowDown" ? t.nextElementSibling : t.previousElementSibling; if (s) s.focus(); ev.preventDefault(); return; }
      if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && t.hasAttribute("aria-expanded")) {
        const n = t.dataset.open; if (ev.key === "ArrowLeft") S.collapsed.add(n); else S.collapsed.delete(n); ev.preventDefault(); return render();
      }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (S.agendaOpen) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
    if (S.selected) closePanel();
  });
  // Удержание фокуса в модальном окне повестки
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab" || !S.agendaOpen) return;
    const m = document.querySelector(".modal"); if (!m) return;
    const f = [...m.querySelectorAll("button, textarea")]; const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
    else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
  });

  // ── Запуск
  if (!SEED || !Array.isArray(SEED.items) || !SEED.items.length) {
    root.innerHTML = `<div class="empty" role="alert"><p>Данные План-графика не загружены. Страница не может построить отображение. Обратитесь к руководителю проекта.</p></div>`;
    return;
  }
  render();
  window.__orbita = { get model() { return M; }, setView, openItem };
})();
