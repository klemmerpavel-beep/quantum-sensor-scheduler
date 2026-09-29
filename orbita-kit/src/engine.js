/* Модуль расчёта «Орбиты». Чистые функции: исходные данные + правки + дата → производные признаки.
   Правила — docs/SPEC.md §4–6; ссылки [Р-NN] — docs/DECISIONS.md. */
const Engine = (() => {
  const DAY = 86400000;
  const STATUSES = ["Не начато", "Нет отметки", "В работе", "Подготовка материалов", "Ожидаем документ", "На согласовании", "Закрыто"];
  const ACTIVE = new Set(["В работе", "Подготовка материалов", "Ожидаем документ", "На согласовании"]);
  const CLS = {
    "Закрыто": "closed", "В работе": "progress", "Подготовка материалов": "progress",
    "Ожидаем документ": "action", "На согласовании": "action", "Нет отметки": "action", "Не начато": "future",
  };

  const dn = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY; };
  const pad = (x) => String(x).padStart(2, "0");
  const fmt = (n) => { if (n == null) return "—"; const d = new Date(n * DAY); return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`; };
  const iso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const todayLocal = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY; };
  const parseISO = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(dn(s)) && iso(dn(s)) === s ? dn(s) : null);

  function calendar(holidays) {
    const H = new Set(holidays.map(dn));
    const isWork = (n) => { const w = new Date(n * DAY).getUTCDay(); return w !== 0 && w !== 6 && !H.has(n); };
    /** Рабочие дни в интервале (a; b] со знаком [Р-47]. */
    const wd = (a, b) => {
      if (a === b) return 0;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      let c = 0;
      for (let x = lo + 1; x <= hi; x++) if (isWork(x)) c++;
      return a < b ? c : -c;
    };
    /** Сдвиг на k рабочих дней (k может быть ≤ 0). */
    const shift = (n, k) => {
      let x = n, left = Math.abs(k);
      const s = k > 0 ? 1 : -1;
      while (left > 0) { x += s; if (isWork(x)) left--; }
      return x;
    };
    const nextWork = (n) => { let x = n + 1; while (!isWork(x)) x++; return x; };
    return { wd, shift, nextWork, isWork };
  }

  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  const remainText = (d) => (d == null ? "" : d > 0 ? `через ${d} дн.` : d === 0 ? "сегодня" : `просрочено ${-d} дн.`);

  /**
   * Построение модели.
   * @param seed   — SEED (data/seed_ymg_stage1.json)
   * @param cfg    — CONFIG (CHAIN, FEEDER, HOLIDAYS, LINKS)
   * @param edits  — правки пользователя { num: {status, closeDoc:{name,letter,date}, comment} }
   * @param T      — «сегодня», номер дня
   */
  function build(seed, cfg, edits, T) {
    const cal = calendar(cfg.HOLIDAYS);
    const items = seed.items.map((s, idx) => ({
      s, idx, num: s.num, kind: s.kind, level: s.level, parent: s.parent, name: s.name,
      owners: s.owners, start: dn(s.start), due: dn(s.due), dueCust: dn(s.due_to_customer),
      ctrl: dn(s.control_date), closedDate: dn(s.closed_date), children: [],
      edit: edits[s.num] || null,
    }));
    const by = Object.fromEntries(items.map((i) => [i.num, i]));
    items.forEach((i) => { if (i.parent) by[i.parent].children.push(i); });
    const isSub = (i) => i.parent && by[i.parent].kind === "group";

    // Отображаемый статус [Р-15]: сначала группы (хранимое/правка), затем работы, затем расчётные группы.
    const own = (i) => {
      if (i.edit && i.edit.status) return { status: i.edit.status, src: "edit" };
      if (i.s.status_mark) return { status: i.s.status, src: "mark" };
      return null;
    };
    items.forEach((i) => {
      if (i.kind === "section") return;
      const o = own(i);
      if (o) { i.status = o.status; i.src = o.src; }
    });
    items.forEach((i) => {
      if (i.kind !== "task" || i.status) return;
      const g = isSub(i) ? by[i.parent] : null;
      if (g && i.due < T && g.status && (g.src === "mark" || g.src === "edit")) {
        i.status = g.status; i.src = "inherited"; i.inheritedFrom = g.num;
      } else if (i.due < T) { i.status = "Нет отметки"; i.src = "rule"; }
      else { i.status = "Не начато"; i.src = "rule"; }
    });
    items.forEach((g) => {
      if (g.kind !== "group" || g.status) return;
      const st = g.children.map((c) => c.status);
      let r = "Не начато";
      if (st.every((x) => x === "Закрыто")) r = "Закрыто";
      else if (st.some((x) => x === "Закрыто" || ACTIVE.has(x))) r = "В работе";
      else if (st.some((x) => x === "Нет отметки")) r = "Нет отметки";
      g.status = r; g.src = "derived";
    });

    // Признаки срока [SPEC 4.3]
    items.forEach((i) => {
      if (i.kind === "section") return;
      i.cls = CLS[i.status];
      i.closed = i.status === "Закрыто";
      i.remain = i.due - T;
      i.overdue = !i.closed && i.due < T;
      i.overdueDays = i.overdue ? T - i.due : 0;
      i.soon = !i.closed && i.remain >= 0 && i.remain <= 7;
      i.ctrlPassed = !i.closed && i.ctrl != null && i.ctrl < T;
      i.ctrlDays = i.ctrlPassed ? T - i.ctrl : 0;
      if (i.closed) {
        const cd = i.edit && i.edit.closeDoc;
        i.closeDate = cd ? dn(cd.date) : i.closedDate;
        i.noReq = cd ? !(cd.name && cd.name.trim()) : i.src === "edit" || (i.src === "mark" && i.closedDate == null);
      }
      i.horizon = i.closed ? "closed" : i.remain < 0 ? "overdue" : i.remain <= 14 ? "h14" : i.remain <= 30 ? "h30" : i.remain <= 60 ? "h60" : "later";
      i.inBase = !isSub(i) || (i.kind === "task" && i.dueCust != null);
      i.comment = (i.edit && i.edit.comment) || "";
    });
    items.forEach((g) => {
      if (g.kind !== "group") return;
      g.progress = { closed: g.children.filter((c) => c.closed).length, total: g.children.length };
      g.overdueSubs = g.children.filter((c) => c.overdue && !c.inBase).map((c) => c.num);
    });

    const work = items.filter((i) => i.kind !== "section");
    const base = work.filter((i) => i.inBase);

    // KPI [SPEC 4.5, Р-44]
    const reached = base.filter((i) => i.due < T);
    const kpi = {
      base: base.length,
      closed: base.filter((i) => i.closed).length,
      noReq: base.filter((i) => i.closed && i.noReq).length,
      reached: reached.length,
      reachedClosed: reached.filter((i) => i.closed).length,
      overdue: base.filter((i) => i.overdue).length,
      early: base.filter((i) => i.closed && i.due >= T).length,
      ctrlPassed: base.filter((i) => i.ctrlPassed).length,
      active: base.filter((i) => ACTIVE.has(i.status)).length,
      toDemoWd: cal.wd(T, dn("2026-11-30")),
      toDemo: dn("2026-11-30") - T,
      toEnd: dn(seed.project.stage_end) - T,
    };
    kpi.pct = kpi.base ? Math.round((kpi.closed / kpi.base) * 100) : 0;

    // Прогресс разделов [SPEC 4.6]
    const sectionOf = (i) => { const p = i.num.split("."); return p[0] === "2" ? p.slice(0, 2).join(".") : p[0]; };
    const sections = ["1", "2.1", "2.2", "3"].map((sn) => {
      const list = base.filter((i) => sectionOf(i) === sn);
      return { num: sn, name: by[sn].name, total: list.length, closed: list.filter((i) => i.closed).length, overdue: list.filter((i) => i.overdue).length };
    });

    // Окна цепочки [Р-47, SPEC 4.7]
    const chainNums = cfg.CHAIN;
    const F = {};
    const forecast = (i, prevF, prevP) => {
      if (i.closed) return i.closeDate != null ? i.closeDate : i.due;
      let f = Math.max(i.due, T);
      if (prevF != null) f = Math.max(f, cal.shift(prevF, Math.min(prevP, 0)));
      return f;
    };
    const windows = [];
    let prevF = null, prevP = null;
    chainNums.forEach((n, k) => {
      const i = by[n];
      F[n] = forecast(i, prevF, prevP);
      if (k < chainNums.length - 1) {
        const j = by[chainNums[k + 1]];
        const P = cal.wd(i.due, j.due);
        windows.push({ from: n, to: j.num, P });
        prevP = P;
      }
      prevF = F[n];
    });
    const feederI = by[cfg.FEEDER.from];
    F[cfg.FEEDER.from] = forecast(feederI, null, null);
    const winState = (w) => {
      const a = by[w.from], b = by[w.to];
      const R = cal.wd(F[w.from], b.due);
      const E = w.P - R;
      let state;
      if (a.closed && b.closed) state = "done";
      else if (R < Math.min(w.P, 0)) state = "breach";
      else if (E > 0) state = "eroding";
      else if (w.P < 0) state = "overlap";
      else if (w.P <= 1) state = "thin";
      else state = "ok";
      const breachFrom = state === "eroding" && !a.closed ? cal.nextWork(b.due) : null;
      return { ...w, R, E, state, breachFrom };
    };
    const chainWindows = windows.map(winState);
    const feeder = winState({ from: cfg.FEEDER.from, to: cfg.FEEDER.to, P: cal.wd(feederI.due, by[cfg.FEEDER.to].due), feeder: true });
    const rank = { breach: 3, eroding: 2, overlap: 1, thin: 1, ok: 1, done: 0 };
    const worst = [...chainWindows, feeder].reduce((a, w) => (rank[w.state] > rank[a] ? w.state : a), "done");
    const chainState = worst === "breach" ? "breach" : worst === "eroding" ? "eroding" : chainNums.every((n) => by[n].closed) ? "done" : "ok";
    const chainSet = new Set([...chainNums, cfg.FEEDER.from]);

    // «Топ-5 рисков» [Р-26, Р-50]
    const ord = (a, b) => a.idx - b.idx;
    const open = work.filter((i) => !i.closed);
    const inChain = (i) => chainSet.has(i.num);
    const cats = [
      open.filter((i) => inChain(i) && i.overdue).sort((a, b) => b.overdueDays - a.overdueDays || ord(a, b)).map((i) => [i, "chain-overdue"]),
      open.filter((i) => inChain(i) && i.soon).sort((a, b) => a.remain - b.remain || ord(a, b)).map((i) => [i, "chain-soon"]),
      open.filter((i) => !inChain(i) && i.inBase && i.overdue).sort((a, b) => b.overdueDays - a.overdueDays || ord(a, b)).map((i) => [i, "overdue"]),
      open.filter((i) => !inChain(i) && i.inBase && i.ctrlPassed).sort((a, b) => b.ctrlDays - a.ctrlDays || ord(a, b)).map((i) => [i, "ctrl"]),
      open.filter((i) => !inChain(i) && i.inBase && i.soon).sort((a, b) => a.remain - b.remain || ord(a, b)).map((i) => [i, "soon"]),
    ];
    const seen = new Set(), top5 = [];
    cats.flat().forEach(([i, why]) => { if (top5.length < 5 && !seen.has(i.num)) { seen.add(i.num); top5.push({ item: i, why }); } });

    return { items, by, work, base, kpi, sections, chainNums, chainSet, chainWindows, feeder, chainState, F, cal, T, top5 };
  }

  /** Текст повестки [SPEC 6, Р-33, Р-50]. */
  function agenda(M) {
    const line = (i) => {
      let c = i.comment || i.s.status_mark || "";
      if (i.kind === "group" && i.overdueSubs && i.overdueSubs.length) {
        c = (c ? c + "; " : "") + `просрочены подпозиции ${i.overdueSubs.join(", ")}`;
      }
      return `${i.name}${c ? " — " + c : ""} (п. ${i.num})`;
    };
    const base = M.base.filter((i) => !i.closed);
    const groupWithSubs = (i) => i.kind === "group" && i.overdueSubs.length;
    const s1 = base.filter((i) => i.overdue || groupWithSubs(i));
    const s2 = base.filter((i) => !s1.includes(i) && i.ctrlPassed);
    const s3 = base.filter((i) => !s1.includes(i) && !s2.includes(i) && i.remain >= 0 && i.remain <= 14);
    const out = [`Повестка оперативки по этапу 1 ОКР «ЯМГ-ИИМ» на ${fmt(M.T)}`, ""];
    const sec = (title, list) => {
      out.push(title);
      if (!list.length) out.push("— позиций нет");
      list.forEach((i, k) => out.push(`${k + 1}. ${line(i)}`));
      out.push("");
    };
    sec("1. Просрочено", s1);
    sec("2. Контрольная дата прошла", s2);
    sec("3. Срок в ближайшие 14 дней", s3);
    return { text: out.join("\n").trim(), counts: [s1.length, s2.length, s3.length], lists: [s1, s2, s3] };
  }

  /**
   * Проверка правок из хранилища браузера [Р-70]: остаются только работы из данных,
   * статусы словаря, документ закрытия со строковыми полями и датой ISO, комментарий-строка (≤ 2000 знаков).
   * Повреждённое или чужое содержимое хранилища не должно ломать расчёт.
   */
  function sanitizeEdits(seed, raw) {
    const out = {}, dropped = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { edits: out, dropped: raw == null ? [] : ["*"] };
    const nums = new Set(seed.items.filter((i) => i.kind !== "section").map((i) => i.num));
    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
    Object.keys(raw).forEach((num) => {
      const e = raw[num];
      if (!nums.has(num) || !e || typeof e !== "object") { dropped.push(num); return; }
      const r = {};
      if (typeof e.status === "string" && STATUSES.includes(e.status)) r.status = e.status;
      if (e.closeDoc && typeof e.closeDoc === "object" && r.status === "Закрыто") {
        const d = parseISO(str(e.closeDoc.date, 10));
        r.closeDoc = { name: str(e.closeDoc.name, 500), letter: str(e.closeDoc.letter, 100), date: d != null ? iso(d) : "" };
      }
      if (typeof e.comment === "string" && e.comment.trim()) r.comment = e.comment.slice(0, 2000);
      if (Object.keys(r).length) out[num] = r; else dropped.push(num);
    });
    return { edits: out, dropped };
  }

  return { build, agenda, sanitizeEdits, dn, fmt, iso, parseISO, todayLocal, remainText, plural, STATUSES, CLS, ACTIVE, calendar };
})();
if (typeof module !== "undefined") module.exports = Engine;
