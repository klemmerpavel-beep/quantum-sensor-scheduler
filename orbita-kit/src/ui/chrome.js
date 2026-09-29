  /* Общие элементы страницы: шапка, плашки, панель инструментов, заголовок режима, подписи вех [Р-59, Р-60]. */
  // ── Шапка и уведомления
  function renderHeader() {
    const tabs = viewsAvail.map(([k, t]) => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${k === view}" aria-controls="main" tabindex="${k === view ? 0 : -1}" data-view="${k}" data-k="tab-${k}">${t}</button>`).join("");
    return `<header class="top">
      <div class="brand"><span class="logo" aria-hidden="true"></span><span class="bt"><b>CRM</b><span class="sub">Квантовый сенсор ИИМ ЯМГ (Электроприбор)</span></span></div>
      <nav class="tabs" role="tablist" aria-label="Режимы отображения">${tabs}</nav>
      <div class="spacer"></div>
      <div class="today" title="${todayFromLink ? "Дата задана параметром ссылки" : "Текущая дата"}">на <b class="mono">${fmt(T)}</b></div>
      <button class="iconbtn help" data-act="help" data-k="help" aria-label="Как читать страницу" title="Как читать страницу">${ico("help")}</button>
      <button class="iconbtn print" data-act="print" data-k="print" aria-label="Печать текущего режима" title="Печать">${ico("printer")}</button>
      <button class="iconbtn theme" data-act="theme" data-k="theme" aria-label="${theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}" title="${theme === "dark" ? "Светлая тема" : "Тёмная тема"}">${ico(theme === "dark" ? "sun" : "moon")}</button>
    </header>`;
  }
  function renderBanners() {
    let h = "";
    if (orgKey) h += `<div class="banner" role="status">${orgKey === "elektropribor" ? `Представление для Исполнителя: <b>${esc(orgName)}</b> — все обязательства, включая работы соисполнителей.` : `Представление для соисполнителя: <b>${esc(orgName)}</b> — работы по договору с Электроприбором.`} Только просмотр.</div>`;
    else if (exec) h += `<div class="banner" role="status">Режим для руководства: только просмотр.</div>`;
    notices.forEach((n) => { h += `<div class="banner warn" role="alert">${ico("alert")} ${esc(n)}</div>`; });
    return h;
  }
  function toolbar(extra = "") {
    const ownerOpts = [["ep", "Электроприбор — все обязательства"], ["fti", "Соисполнитель ФТИ им. Иоффе"], ["ihs", "Соисполнитель ИХС им. Гребенщикова"], ["kv", "С участием Заказчика"]];
    const secOpts = [["1", "Запуск"], ["2.1", "3 квартал 2026 года"], ["2.2", "4 квартал 2026 года"], ["3", "Сдача этапа 1"]];
    return `<div class="toolbar" role="search">
      <label class="field search">${ico("search")}<span class="sr">Поиск по наименованию или номеру</span><input type="search" data-f="search" data-k="f-search" placeholder="Поиск работы" value="${esc(S.filters.search)}"></label>
      ${orgKey ? "" : `<label class="field"><span class="sr">Исполнитель</span><select data-f="owner" data-k="f-owner"><option value="">Все участники</option>${ownerOpts.map(([v, t]) => `<option value="${v}" ${S.filters.owner === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`}
      <label class="field"><span class="sr">Раздел</span><select data-f="section" data-k="f-section"><option value="">Все разделы</option>${secOpts.map(([v, t]) => `<option value="${v}" ${S.filters.section === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      ${anyFilter() ? `<button class="btn link" data-act="reset-filters" data-k="reset-f">Сбросить</button>` : ""}
      <div class="spacer"></div>${extra}
    </div>`;
  }
  const emptyFiltered = () => `<div class="empty" role="status"><p>Нет работ, соответствующих условиям. Измените поиск или сбросьте фильтр.</p><button class="btn" data-act="reset-filters" data-k="reset-f2">Сбросить фильтр</button></div>`;

  /** Заголовок режима: вывод одной фразой и, при необходимости, полоса показателей [Р-60]. */
  const pageHead = (id, h, lead, extra = "") => (extra ? `<section class="phead" aria-labelledby="${id}"><h1 id="${id}" class="sr">${esc(h)}</h1>${extra}</section>` : `<h1 id="${id}" class="sr">${esc(h)}</h1>`);
  /** Подписи вех по дорожкам без наложения; W — ширина полосы в пикселях. */
  function msLabels(W, top) {
    const lanes = []; let h = "";
    MS.forEach((m) => {
      const x = (xp(m.n) / 100) * W, name = MS_SHORT[m.date] || m.title, w = 44 + name.length * 7;
      const right = x + w > W, a = right ? x - w : x, b = right ? x : x + w;
      let lane = lanes.findIndex((r) => a >= r + 12);
      if (lane < 0) { lanes.push(0); lane = lanes.length - 1; }
      lanes[lane] = b;
      h += `<span class="stl-lbl${m.n < T ? " past" : ""}${right ? " r" : ""}" style="left:${xp(m.n)}%;top:${top + lane * 22}px"><b>${fmt(m.n).slice(0, 5)}</b> ${esc(name)}</span>`;
      h += `<span class="stl-tick" style="left:${xp(m.n)}%;top:${top - 22}px;height:${lane * 22 + 22}px"></span>`;
    });
    return { html: h, lanes: lanes.length };
  }
  const bandW = (min) => Math.max(min, (root.clientWidth || innerWidth) - 2 * 32 - 2 * 24);
