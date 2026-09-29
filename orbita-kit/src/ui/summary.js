  /* Режим «Сводка» (В1, В3): вывод, показатели, сроки этапа, участники, путь к демонстрации [Р-58]. */
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
      tile("plan", "План на сегодня", `${k.reachedClosed}<small> из ${k.reached}</small>`, k.early ? `ещё ${k.early} — досрочно` : "", "go-overdue"),
      tile("overdue", "Просрочено", `${k.overdue}`, "", "go-overdue", k.overdue ? "bad" : ""),
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
    h += `</div></div><div class="legend stl-leg" aria-hidden="true"><span><i class="lg closed"></i>выполнено</span><span><i class="lg overdue-s"></i>просрочено</span><span><i class="lg future"></i>предстоит</span><span><i class="lg ms"></i>веха</span></div>`;
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
    return `<ul class="olist">${row("ep", "Электроприбор", "Исполнитель", B.filter((i) => resp(i) === EP), "ближайший срок")}</ul>
      <p class="osub">Соисполнители — через Исполнителя</p>
      <ul class="olist">${row("fti", "ФТИ им. Иоффе", "соисполнитель", B.filter(OWNER_F.fti), "ближайший срок")}${row("ihs", "ИХС им. Гребенщикова", "соисполнитель", B.filter(OWNER_F.ihs), "ближайший срок")}</ul>
      <p class="osub">Участие Заказчика</p>
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
    if (!notes.length) return "";
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
      <section class="hero" aria-labelledby="h-main"><h1 id="h-main">${esc(hl.h)}</h1><span class="asof">на ${fmt(T)}${EDITION != null && T !== EDITION ? ` · отметки на ${fmt(EDITION)}` : ""}</span></section>
      <section class="kpis" aria-label="Ключевые показатели">${kpiTiles()}</section>
      <section class="card" aria-labelledby="h-tl"><h2 id="h-tl">Сроки этапа<span class="spacer"></span><button class="btn link" data-act="go-ms" data-k="tl-open">Все вехи ${ico("arrow")}</button></h2>${stageTimeline()}</section>
      <div class="cols">
        <div class="stack">
          <section class="card" aria-labelledby="h-r"><h2 id="h-r">Требует внимания</h2>${attention()}</section>
          <section class="card" aria-labelledby="h-o"><h2 id="h-o">Исполнитель и соисполнители</h2>${ownersBlock()}</section>
        </div>
        <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Путь к демонстрации образца ${chainPill()}<span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">На графике ${ico("arrow")}</button></h2>${pathSteps(false, true)}${pathNotes()}</section>
      </div>
      <section class="card" aria-labelledby="h-s"><h2 id="h-s">Ход работ по разделам</h2>${sectionsBlock()}</section>
    </div>`;
  }
  function viewSummaryPath() {
    const hl = headline();
    return `<div class="page">
      <section class="hero" aria-labelledby="h-main"><h1 id="h-main">${esc(hl.h)}</h1><span class="asof">на ${fmt(T)}${EDITION != null && T !== EDITION ? ` · отметки на ${fmt(EDITION)}` : ""}</span></section>
      <section class="card" aria-labelledby="h-ch"><h2 id="h-ch">Путь к демонстрации лабораторного образца ${chainPill()}<span class="spacer"></span><button class="btn link" data-act="go-chain" data-k="ch-open">Подробно на графике ${ico("arrow")}</button></h2>${pathSteps(true)}${pathNotes()}</section>
      <section class="kpis" aria-label="Ключевые показатели">${kpiTiles()}</section>
      <div class="cols">
        <section class="card" aria-labelledby="h-r"><h2 id="h-r">Требует внимания</h2>${attention()}</section>
        <section class="card" aria-labelledby="h-o"><h2 id="h-o">Исполнитель и соисполнители</h2>${ownersBlock()}</section>
      </div>
    </div>`;
  }
