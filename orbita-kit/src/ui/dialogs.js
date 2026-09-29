  /* Окна: повестка оперативки в двух форматах, отметки в этом браузере, справка «Как читать страницу» [Р-62, Р-65, Р-71]. */
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
    ["I. Просрочено", "II. Контрольная дата прошла", "III. Срок в ближайшие 14 дней"].forEach((h, k) => {
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
      <div class="mhdr"><div class="mh"><h2 id="ag-title">Повестка оперативки на ${fmt(T)}</h2><p class="note">Вопросы к Исполнителю — Электроприбору</p></div><button class="iconbtn" data-act="close-agenda" data-k="ag-x" aria-label="Закрыть">${ico("x")}</button></div>
      <div class="agbar"><div class="agc"><span class="agn bad">${a.counts[0]}</span>просрочено</div><div class="agc"><span class="agn warn">${a.counts[1]}</span>контрольная дата прошла</div><div class="agc"><span class="agn">${a.counts[2]}</span>срок в 14 дней</div><span class="spacer"></span>${seg}</div>
      <p class="note mp">Учитываются обязательства перед Заказчиком; просроченные подпозиции — в строке своей группы.</p>
      <label class="sr" for="ag-text">Текст повестки</label><textarea id="ag-text" readonly data-k="ag-text">${esc(text)}</textarea><div class="ag-print" aria-hidden="true">${esc(text)}</div>
      <div class="mftr"><span class="note" id="ag-status" role="status"></span><button class="btn" data-act="print" data-k="ag-print">${ico("printer")} Печать</button><button class="btn primary" data-act="copy-agenda" data-k="ag-copy">${ico("copy")} Скопировать</button><button class="btn" data-act="close-agenda" data-k="ag-close">Закрыть</button></div></div></div>`;
  }

  // ── Отметки в этом браузере [Р-71]: что изменено относительно редакции, текст для письма, сброс с подтверждением
  function marksList() {
    const base = E.build(SEED, C, {}, T);
    return SEED.items.filter((s) => edits[s.num]).map((s) => ({ num: s.num, e: edits[s.num], was: base.by[s.num], now: M.by[s.num] }));
  }
  function marksText(list) {
    const out = [`Отметки по этапу 1 ОКР «ЯМГ-ИИМ» к редакции План-графика и вкладки «Важное» на ${fmt(EDITION)}`, `Состояние на ${fmt(T)}`, ""];
    list.forEach((m, k) => {
      const t = [m.e.status && m.e.status !== m.was.status ? `статус «${m.was.status}» → «${m.now.status}»` : "статус без изменений"];
      const cd = m.e.closeDoc;
      if (cd) t.push(cd.name ? `документ: ${cd.name}${cd.letter ? `, № ${cd.letter}` : ""}${cd.date ? ` от ${fmt(E.dn(cd.date))}` : ""}` : "без подтверждающего документа");
      if (m.e.comment) t.push(`комментарий: ${m.e.comment}`);
      out.push(`${k + 1}. ${title(m.now)} (п. ${m.num}): ${t.join("; ")}.`);
    });
    return out.join("\n");
  }
  function renderMarks() {
    if (!S.marksOpen) return "";
    const list = marksList(), n = list.length;
    const docCell = (m) => { const cd = m.e.closeDoc; return cd ? (cd.name ? `${esc(cd.name)}${cd.letter ? `, № ${esc(cd.letter)}` : ""}${cd.date ? `, ${fmt(E.dn(cd.date))}` : ""}` : `<span class="muted">без документа</span>`) : ""; };
    const rows = list.map((m) => `<tr><td><button class="btn link" data-act="marks-open" data-num="${m.num}" data-k="mk-${m.num}">${esc(title(m.now))}</button></td><td data-l="По данным">${status(m.was, false)}</td><td data-l="Отметка">${m.e.status && m.e.status !== m.was.status ? status(m.now, false) : `<span class="muted">без изменений</span>`}</td><td data-l="Документ, комментарий">${docCell(m)}${m.e.comment ? `<div class="mk-c">${esc(m.e.comment)}</div>` : ""}</td></tr>`).join("");
    const confirm = S.marksConfirm && n
      ? `<div class="warnbox mk-confirm" role="alert">${ico("alert")}<span>Будут удалены ${n} ${pl(n, "отметка", "отметки", "отметок")} в этом браузере. Исходные данные План-графика не изменятся. Отменить удаление нельзя.</span></div>`
      : "";
    const foot = S.marksConfirm && n
      ? `<button class="btn danger" data-act="marks-reset" data-k="mk-reset-do">Удалить отметки</button><button class="btn" data-act="marks-cancel" data-k="mk-reset-no">Отмена</button>`
      : `${n ? `<button class="btn" data-act="marks-ask" data-k="mk-reset">${ico("reset")} Сбросить все</button><button class="btn primary" data-act="copy-marks" data-k="mk-copy">${ico("copy")} Скопировать текст</button>` : ""}<button class="btn${n ? "" : " primary"}" data-act="close-marks" data-k="mk-close">Закрыть</button>`;
    return `<div class="modal-back" data-act="close-marks-bg"><div class="modal marks" role="dialog" aria-modal="true" aria-labelledby="mk-title">
      <div class="mhdr"><div class="mh"><h2 id="mk-title">Отметки в этом браузере</h2><p class="note">Изменения относительно редакции на ${fmt(EDITION)}. Другие пользователи их не видят.</p></div><button class="iconbtn" data-act="close-marks" data-k="mk-x" aria-label="Закрыть">${ico("x")}</button></div>
      <div class="mk-body">${n ? `<table class="mk-tbl"><thead><tr><th scope="col">Работа</th><th scope="col">По данным</th><th scope="col">Отметка</th><th scope="col">Документ, комментарий</th></tr></thead><tbody>${rows}</tbody></table>
      <label class="sr" for="mk-text">Текст для письма</label><textarea id="mk-text" readonly data-k="mk-text" rows="${Math.min(n + 4, 10)}">${esc(marksText(list))}</textarea>` : `<p class="muted">Отметок нет: показаны исходные данные.</p>`}${confirm}</div>
      <div class="mftr"><span class="note" id="mk-status" role="status"></span>${foot}</div></div></div>`;
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
          <li>Смена статуса и комментарии сохраняются только в этом браузере и не видны другим. Исходные данные План-графика не меняются; кнопка «Отметки» в подвале показывает их список, даёт текст для письма и сброс.</li></ul></section>
      </div>
      <div class="mftr"><button class="btn primary" data-act="close-help" data-k="hp-close">Понятно</button></div></div></div>`;
  }
