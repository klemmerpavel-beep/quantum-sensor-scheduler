  /* Режим «Ближайшие сроки»: периоды и строки работ [Р-60]. */
  // ── БЛИЖАЙШИЕ СРОКИ (Фокус) [Р-60]
  const LANES = [["overdue", "Просрочено"], ["h14", "В ближайшие 14 дней"], ["h30", "В течение месяца"], ["h60", "В течение двух месяцев"], ["later", "Позднее"], ["closed", "Выполнено"]];
  function viewFocus() {
    const list = M.work.filter((i) => matchesFilters(i));
    const range = { overdue: "", h14: `до ${fmt(T + 14)}`, h30: `${fmt(T + 15)} – ${fmt(T + 30)}`, h60: `${fmt(T + 31)} – ${fmt(T + 60)}`, later: `после ${fmt(T + 60)}`, closed: "" };
    const off = !orgKey && !anyFilter() ? SEED.off_plan_closed : [];
    const rowsOf = (k) => list.filter((i) => i.horizon === k).sort((a, b) => a.due - b.due || a.idx - b.idx);
    const cnt = Object.fromEntries(LANES.map(([k]) => [k, rowsOf(k).length + (k === "closed" ? off.length : 0)]));
    const ctrl = list.filter((i) => i.ctrlPassed).length;
    const lead = `На ${fmt(T)}: просрочено ${cnt.overdue}, в ближайшие 14 дней — ${cnt.h14}, в течение месяца — ${cnt.h30}, в течение двух месяцев — ${cnt.h60}.${ctrl ? ` У ${ctrl} ${pl(ctrl, "работы", "работ", "работ")} прошла контрольная дата оперативки.` : ""}${anyFilter() ? " Показаны работы по условиям отбора." : ""}`;
    const strip = `<nav class="hstrip" aria-label="Периоды">${LANES.map(([k, t]) => `<button class="hz ${k}${k === "overdue" && cnt[k] ? " bad" : k === "h14" && cnt[k] ? " warn" : ""}" data-act="go-lane" data-lane="${k}" data-k="hz-${k}"><span class="lbl">${t}</span><span class="val">${cnt[k]}</span>${range[k] ? `<span class="sub">${range[k]}</span>` : ""}</button>`).join("")}</nav>`;
    const agendaBtn = readonly ? "" : `<button class="btn primary" data-act="agenda" data-k="agenda">${ico("file")} Повестка оперативки</button>`;
    let h = toolbar(agendaBtn) + `<div class="page">` + pageHead("h-focus", "Ближайшие сроки", esc(lead), strip);
    if (!list.length) return h + emptyFiltered() + `</div>`;
    LANES.forEach(([k, t]) => {
      const rows = rowsOf(k), offk = k === "closed" ? off : [];
      const open = k === "later" || k === "closed" ? S.lanes[k] : true;
      h += `<details class="lane ${k}" ${open ? "open" : ""} data-lane="${k}"><summary data-k="lane-${k}"><span class="chev">${ico("chev")}</span>${t}<span class="cnt">${rows.length + offk.length}</span></summary>`;
      if (!rows.length && !offk.length) h += `<p class="muted empty-line">Работ в этом периоде нет.</p>`;
      else h += `<div class="fhead" aria-hidden="true"><span>Работа</span><span>Исполнитель</span><span>Срок</span><span>${k === "closed" ? "Выполнено" : "Осталось"}</span><span>Статус</span></div>`;
      rows.forEach((i) => {
        h += `<button class="frow" data-open="${i.num}" data-k="f-${i.num}" title="${nameAttr(i)}"><span class="t">${esc(title(i))}${i.src === "inherited" ? `<span class="st-note">в составе «${esc(title(M.by[i.inheritedFrom]))}»</span>` : ""}</span><span class="own">${ownersCell(i)}</span><span class="mono d">${fmt(i.due)}</span><span class="dw">${k === "closed" ? (i.closeDate != null ? `<span class="due-t">${fmt(i.closeDate)}</span>` : `<span class="due-t">дата не указана</span>`) : dueWords(i, false)}</span><span class="stc">${status(i, false)}${i.ctrlPassed ? `<span class="due-t warn">контрольная дата ${fmt(i.ctrl)} прошла</span>` : ""}${i.closed && i.noReq ? `<span class="st-note">без документа</span>` : ""}</span></button>`;
      });
      offk.forEach((o) => { h += `<div class="frow" role="note"><span class="t">${esc(o.name)}<span class="st-note">вне План-графика</span></span><span class="own">Электроприбор</span><span class="mono d">${fmt(E.dn(o.transfer))}</span><span class="dw"><span class="due-t">передано</span></span><span class="stc"><span class="st st-closed"><i aria-hidden="true"></i>${esc(o.mark)}</span></span></div>`; });
      h += `</details>`;
    });
    return h + `</div>`;
  }
