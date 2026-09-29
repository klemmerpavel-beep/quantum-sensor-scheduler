  /* Ядро интерфейса: данные, параметры ссылки, состояние, форматы, роли участников, шкала этапа [SPEC §2–4; Р-55, Р-61]. */
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
  // Режим для руководства: ?view=exec (первый экран) или ?exec=1 (сохраняется при смене вкладки) [Р-67]
  const exec = q.get("view") === "exec" || q.get("exec") === "1";
  const readonly = exec || q.has("org");
  const VIEWS = [["summary", "Сводка"], ["gantt", "График работ"], ["focus", "Ближайшие сроки"], ["board", "Статусы"], ["milestones", "Вехи"]];
  const viewsAvail = orgKey ? VIEWS.filter(([k]) => k !== "summary") : VIEWS;
  const defaultView = orgKey ? "focus" : VARIANT === "registry" ? "gantt" : "summary";
  let view = q.get("view") === "exec" ? "summary" : q.get("view");
  if (view && !viewsAvail.some(([k]) => k === view)) { notices.push("Параметр view не распознан, открыт режим по умолчанию."); view = null; }
  view = view || defaultView;

  let theme = q.get("theme");
  if (theme !== "light" && theme !== "dark") theme = store.get(C.THEME_KEY) === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);

  // ── Состояние
  let edits = {};
  if (!readonly) {
    let raw = null;
    try { raw = JSON.parse(store.get(C.STORAGE_KEY) || "{}"); } catch (e) { raw = []; }
    const chk = E.sanitizeEdits(SEED, raw);
    edits = chk.edits;
    if (chk.dropped.length) notices.push("Часть сохранённых отметок не распознана и не применена; исходные данные не затронуты.");
  }
  // Дата редакции отметок «Важного» [Р-70]: при расчёте на другую дату отметки могут быть устаревшими
  const EDITION = E.parseISO(SEED.project.demo_today);
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
