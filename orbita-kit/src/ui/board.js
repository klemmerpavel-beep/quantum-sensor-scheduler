  /* Режим «Статусы»: распределение и колонки словаря [Р-60]. */
  // ── СТАТУСЫ (Доска)
  function viewBoard() {
    const list = M.work.filter((i) => matchesFilters(i));
    let h = toolbar();
    if (!list.length) return h + `<h1 class="sr">Статусы</h1>` + emptyFiltered();
    const n = (f) => list.filter(f).length;
    const g = { closed: n((i) => i.cls === "closed"), progress: n((i) => i.cls === "progress"), action: n((i) => i.cls === "action"), future: n((i) => i.cls === "future") };
    const od = n((i) => i.overdue), inh = n((i) => i.src === "inherited");
    const lead = `${list.length} ${pl(list.length, "работа", "работы", "работ")}: выполнено ${g.closed}, в работе и подготовке ${g.progress}, требуют действия ${g.action}, не начато ${g.future}. Просрочено ${od}${inh ? `; у ${inh} статус взят по группе` : ""}.`;
    const words = { closed: "выполнено", progress: "в работе и подготовке", action: "требуют действия", future: "не начато" };
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
