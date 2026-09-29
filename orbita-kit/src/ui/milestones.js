  /* Режим «Вехи»: полоса дат, готовность к вехам, работы выбранной даты [Р-60, Р-64]. */
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
    const lb = msLabels(bandW(1060), 172);
    h += `<section class="card" aria-labelledby="h-msc"><h2 id="h-msc">Вехи и загрузка по датам</h2><div class="ms-scroll"><div class="ms-canvas" style="height:${172 + lb.lanes * 22 + 4}px">`;
    monthStarts().forEach((m) => { if (xp(m.n) < 96) h += `<span class="ms-month" style="left:${xp(m.n)}%">${m.label}</span>`; });
    h += `<div class="ms-axis"></div>`;
    keys.forEach((d) => {
      const c = clusters.get(d), cl = c.filter((i) => i.closed).length;
      h += `<button class="ms-cl" style="left:${xp(d)}%" aria-pressed="${S.msDate === d}" data-ms="${d}" data-k="ms-${d}" title="${fmt(d)}: ${c.length}" aria-label="${fmt(d)}: ${c.length} ${pl(c.length, "работа", "работы", "работ")}, выполнено ${cl}">${c.map((i) => `<i class="${i.overdue ? "overdue" : i.cls}"></i>`).join("")}</button>`;
      if (c.length >= 5 || c.length === peak) h += `<span class="ms-cn" style="left:${xp(d)}%;bottom:calc(100% - 140px + ${c.length * 10 + 8}px)"><span class="mono">${fmt(d).slice(0, 5)}</span> · ${c.length}</span>`;
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
    h += `<div class="cols even"><section class="card" aria-labelledby="h-msl"><h2 id="h-msl">Вехи этапа</h2><ul class="mlist3">${rowsMs}</ul></section>`;
    h += sel ? `<section class="card" aria-labelledby="h-mss"><h2 id="h-mss">Срок ${fmt(S.msDate)} <span class="note">${sel.length} ${pl(sel.length, "работа", "работы", "работ")}</span></h2><ul class="list">${sel.map((i) => `<li><button class="lrow" data-open="${i.num}" data-k="msl-${i.num}" title="${nameAttr(i)}"><span class="t">${esc(title(i))}<span class="own">${esc(ownersText(i))}</span></span><span class="stc">${status(i)}${dueWords(i, true)}</span></button></li>`).join("")}</ul></section>` : `<section class="card"><p class="muted">Выберите дату на полосе.</p></section>`;
    return h + `</div></div>`;
  }
