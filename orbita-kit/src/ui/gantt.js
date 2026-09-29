  /* Режим «График работ» (В2 — первый экран): таблица, шкала, мобильный список [Р-49, Р-60]. */
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
    if (g) h += `<span class="gp" style="width:${i.progress.total ? (i.progress.closed / i.progress.total) * 100 : 0}%"></span>`;
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
        <td class="stg">${ctx ? "" : status(i)}</td>`}
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
