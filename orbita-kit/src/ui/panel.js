  /* Карточка работы: статус, закрытие с документом, ответственность, связи [Р-31, Р-61, Р-62]. */
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
      if (i.unconf) h += `<p class="note warnnote">Срок ${fmt(i.due)} прошёл после даты отметок «Важного» (${fmt(EDITION)}); отметки о выполнении нет.${readonly ? "" : " Уточните у Исполнителя и отметьте статус."}</p>`;
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
            <label>Дата (ДД.ММ.ГГГГ)<input inputmode="numeric" data-cf="date" data-k="cf-date" value="${esc(f.date)}" aria-invalid="${f.dateBad || f.dateLate ? "true" : "false"}"></label></div>
            ${f.dateBad ? `<span class="due-t bad" role="alert">Укажите дату в формате ДД.ММ.ГГГГ, например ${fmt(T)}.</span>` : ""}
            ${f.dateLate ? `<span class="due-t bad" role="alert">Дата документа не может быть позже ${fmt(T)}.</span>` : ""}
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
    if (i.kind === "group") h += `<section><h3>Состав группы</h3><ul class="plist">${i.children.map((c) => `<li><button data-open="${c.num}" data-k="pc-${c.num}"><span class="t">${esc(title(c))}</span>${status(c, false)}<span class="d">${fmt(c.due)}${c.overdue ? ` · <span class="bad-t">−${c.overdueDays} дн.</span>` : c.unconf ? ` · <span class="warn-t">срок прошёл</span>` : ""}</span></button></li>`).join("")}</ul></section>`;
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
