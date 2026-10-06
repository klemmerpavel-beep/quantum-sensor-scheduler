  /* Отрисовка, адрес страницы, навигация, обработчики событий, запуск [Р-66, Р-67]. */
  // ── Отрисовка
  const root = document.getElementById("app");
  function render() {
    const act = document.activeElement;
    const fk = act && act.getAttribute && act.getAttribute("data-k");
    const sel = act && "selectionStart" in act ? [act.selectionStart, act.selectionEnd] : null;
    const scrollers = [...document.querySelectorAll(".gwrap,.board,.panel .body,.ms-scroll")].map((e) => [e.className.split(" ")[0], e.scrollTop, e.scrollLeft]);
    recompute();
    let main;
    try { main = { summary: viewSummary, gantt: viewGantt, focus: viewFocus, board: viewBoard, milestones: viewMilestones }[view](); }
    catch (err) { console.error(err); main = `<div class="empty" role="alert"><p>Не удалось построить отображение. Обновите страницу; если ошибка повторится, сообщите руководителю проекта.</p></div>`; }
    root.innerHTML = `<a class="skip" href="#main">Перейти к содержанию</a>${renderHeader()}${renderBanners()}
      <main id="main" tabindex="-1" class="v-${view}"><div class="tabpanel" role="tabpanel" aria-labelledby="tab-${view}">${main}</div></main>
      <footer class="foot">${!readonly && Object.keys(edits).length ? `<button class="btn link" data-act="marks" data-k="marks">Отметки в этом браузере: ${Object.keys(edits).length}</button>` : ""}<span>Источник — План-график этапа 1 и вкладка «Важное», редакция на ${fmt(EDITION)}.</span><span title="${esc(C.HOLIDAYS_NOTE)}">Рабочие дни — по производственному календарю РФ, включая переносы 2026–2027 годов.</span>${!store.ok ? "<span>Отметки хранятся только до перезагрузки страницы.</span>" : ""}</footer>
      ${renderPanel()}${renderAgenda()}${renderMarks()}${renderHelp()}`;
    const tb = root.querySelector(".tabs"), cur = tb && tb.querySelector('[aria-selected="true"]');
    if (tb) {
      if (cur && (cur.offsetLeft + cur.offsetWidth > tb.scrollLeft + tb.clientWidth || cur.offsetLeft < tb.scrollLeft)) tb.scrollLeft = cur.offsetLeft - 8;
      const upd = () => tb.classList.toggle("more", tb.scrollLeft + tb.clientWidth < tb.scrollWidth - 2);
      upd(); tb.addEventListener("scroll", upd, { passive: true });
    }
    scrollers.forEach(([cls, t, l]) => { const e = document.getElementsByClassName(cls)[0]; if (e) { e.scrollTop = t; e.scrollLeft = l; } });
    syncUrl();
    if (fk) { const el = root.querySelector(`[data-k="${CSS.escape(fk)}"]`); if (el) { el.focus({ preventScroll: true }); if (sel && "setSelectionRange" in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* не текстовое поле */ } } }
  }
  /** Адрес страницы отражает режим, открытую работу и отбор — ссылку можно передать [Р-66]. */
  function syncUrl() {
    const u = new URL(location.href), set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    u.searchParams.set("view", exec && view === "summary" ? "exec" : view);
    set("exec", exec && view !== "summary" ? "1" : "");
    set("item", S.selected); set("who", orgKey ? "" : S.filters.owner); set("sec", S.filters.section);
    try { history.replaceState(null, "", u); } catch (e) { /* file:// в некоторых браузерах */ }
  }
  function setView(v) {
    view = v; S.closeForm = null;
    render();
    const t = document.getElementById("tab-" + v); if (t) t.focus();
  }
  function openItem(num, from) { S.returnFocus = from && from.getAttribute("data-k"); S.selected = num; S.closeForm = null; render(); const h = document.getElementById("p-title"); if (h) h.focus(); }
  function closePanel() { S.selected = null; S.closeForm = null; render(); if (S.returnFocus) { const el = root.querySelector(`[data-k="${CSS.escape(S.returnFocus)}"]`); if (el) el.focus(); } }
  function closeMarks() { S.marksOpen = false; S.marksConfirm = false; render(); const b = document.querySelector('[data-k="marks"]'); if (b) b.focus(); }
  function setEdit(num, patch) {
    edits[num] = Object.assign({}, edits[num] || {}, patch);
    Object.keys(edits[num]).forEach((k) => { if (edits[num][k] === undefined) delete edits[num][k]; });
    if (!Object.keys(edits[num]).length) delete edits[num];
    saveEdits();
  }
  const clearFilters = () => { S.filters = { owner: "", section: "", search: "" }; };

  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act],[data-view],[data-open],[data-toggle],[data-slice],[data-status],[data-ms]");
    if (!t) return;
    if (t.dataset.view) return setView(t.dataset.view);
    if (t.dataset.toggle) { ev.stopPropagation(); const n = t.dataset.toggle; S.collapsed.has(n) ? S.collapsed.delete(n) : S.collapsed.add(n); return render(); }
    if (t.dataset.slice) { S.slice = t.dataset.slice; return render(); }
    if (t.dataset.ms) { S.msDate = Number(t.dataset.ms); return render(); }
    if (t.dataset.status) {
      const i = M.by[S.selected], st = t.dataset.status;
      if (st === "Закрыто") { S.closeForm = { num: i.num, name: i.s.output_doc || "", letter: "", date: fmt(T) }; return render(); }
      S.closeForm = null; setEdit(i.num, { status: st, closeDoc: undefined }); return render();
    }
    if (t.dataset.open && !t.dataset.act) return openItem(t.dataset.open, t);
    const a = t.dataset.act;
    if (a === "copy-link") {
      const st = document.getElementById("p-link-st"), url = location.href;
      const done = () => { if (st) st.textContent = " Ссылка скопирована."; };
      const manual = () => { if (st) st.textContent = ` ${url}`; };
      try { navigator.clipboard.writeText(url).then(done, manual); } catch (e) { manual(); }
      return;
    }
    if (a === "help") { S.returnFocus = "help"; S.helpOpen = true; render(); const c = document.querySelector('[data-k="hp-close"]'); if (c) c.focus(); return; }
    if (a === "close-help" || (a === "close-help-bg" && ev.target === t)) { S.helpOpen = false; render(); const b = document.querySelector('[data-k="help"]'); if (b) b.focus(); return; }
    if (a === "print") { try { window.print(); } catch (e) { /* печать недоступна */ } return; }
    if (a === "theme") { theme = theme === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", theme); store.set(C.THEME_KEY, theme); return render(); }
    if (a === "reset-filters") { clearFilters(); S.slice = "all"; return render(); }
    if (a === "collapse-all") { M.items.filter((i) => i.kind === "section" && i.num !== "2").forEach((i) => S.collapsed.add(i.num)); return render(); }
    if (a === "expand-all") { S.collapsed.clear(); return render(); }
    if (a === "go-overdue") { S.slice = "overdue"; clearFilters(); return setView("gantt"); }
    if (a === "go-chain") { S.slice = "chain"; clearFilters(); return setView("gantt"); }
    if (a === "go-board") return setView("board");
    if (a === "go-ms") return setView("milestones");
    if (a === "go-lane") {
      const k = t.dataset.lane; if (k in S.lanes) S.lanes[k] = true; render();
      const d = root.querySelector(`details[data-lane="${k}"]`); if (d) { d.scrollIntoView({ block: "start", behavior: "smooth" }); const sm = d.querySelector("summary"); if (sm) sm.focus({ preventScroll: true }); }
      return;
    }
    if (a === "go-owner") { S.slice = "all"; clearFilters(); S.filters.owner = t.dataset.owner; return setView("focus"); }
    if (a === "go-section") { S.slice = "all"; clearFilters(); S.filters.section = t.dataset.sec; S.collapsed.clear(); return setView("gantt"); }
    if (a === "close-panel") return closePanel();
    if (a === "cancel-close") { S.closeForm = null; return render(); }
    if (a === "do-close") {
      const f = S.closeForm, m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(f.date.trim());
      const iso = m && E.parseISO(`${m[3]}-${m[2]}-${m[1]}`) != null ? `${m[3]}-${m[2]}-${m[1]}` : null;
      f.dateLate = !!iso && E.dn(iso) > T;
      if (!iso || f.dateLate) { f.dateBad = !iso; render(); const d = document.querySelector('[data-k="cf-date"]'); if (d) d.focus(); return; }
      setEdit(f.num, { status: "Закрыто", closeDoc: { name: f.name.trim(), letter: f.letter.trim(), date: iso } });
      S.closeForm = null; return render();
    }
    if (a === "reset-one") { delete edits[S.selected]; saveEdits(); S.closeForm = null; return render(); }
    if (a === "marks") { S.marksOpen = true; S.marksConfirm = false; render(); const c = document.querySelector('[data-k="mk-copy"],[data-k="mk-close"]'); if (c) c.focus(); return; }
    if (a === "close-marks" || (a === "close-marks-bg" && ev.target === t)) return closeMarks();
    if (a === "marks-open") { const n = t.dataset.num; S.marksOpen = false; return openItem(n, root.querySelector('[data-k="marks"]')); }
    if (a === "marks-ask" || a === "marks-cancel") { S.marksConfirm = a === "marks-ask"; render(); const b = document.querySelector(`[data-k="${a === "marks-ask" ? "mk-reset-no" : "mk-reset"}"]`); if (b) b.focus(); return; }
    if (a === "marks-reset") { edits = {}; saveEdits(); S.closeForm = null; S.marksOpen = false; S.marksConfirm = false; render(); const m = document.getElementById("main"); if (m) m.focus(); return; }
    if (a === "copy-marks") {
      const ta = document.getElementById("mk-text"), st = document.getElementById("mk-status");
      const done = () => { st.textContent = "Текст скопирован."; };
      const manual = () => { ta.focus(); ta.select(); st.textContent = "Автоматическое копирование недоступно: текст выделен, скопируйте его вручную."; };
      try { navigator.clipboard.writeText(ta.value).then(done, manual); } catch (e) { manual(); }
      return;
    }
    if (a === "agenda") { S.agendaOpen = true; render(); const c = document.querySelector('[data-k="ag-copy"]'); if (c) c.focus(); return; }
    if (a === "close-agenda" || (a === "close-agenda-bg" && ev.target === t)) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
    if (a === "ag-fmt") { S.agendaFmt = t.dataset.fmt; render(); const b = document.querySelector(`[data-k="ag-${t.dataset.fmt === "letter" ? "letter" : "talk"}"]`); if (b) b.focus(); return; }
    if (a === "copy-agenda") {
      const ta = document.getElementById("ag-text"), st = document.getElementById("ag-status");
      const done = () => { st.textContent = "Текст скопирован."; };
      const manual = () => { ta.focus(); ta.select(); st.textContent = "Автоматическое копирование недоступно: текст выделен, скопируйте его вручную."; };
      try { navigator.clipboard.writeText(ta.value).then(done, manual); } catch (e) { manual(); }
    }
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.f) { S.filters[t.dataset.f] = t.value; render(); }
    else if (t.dataset.cf) { S.closeForm[t.dataset.cf] = t.value; if (t.dataset.cf === "name") render(); }
    else if (t.dataset.comment) setEdit(t.dataset.comment, { comment: t.value.trim() ? t.value : undefined });
  });
  root.addEventListener("change", (ev) => { if (ev.target.dataset.mspick !== undefined) { S.msDate = Number(ev.target.value); render(); } });
  // Комментарий: перерисовка после ухода из поля. Если поле покинуто нажатием мыши, перерисовка ждёт завершения нажатия,
  // иначе кнопка под указателем заменяется до события click и нажатие теряется [Р-72].
  let pointerDown = false;
  document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
  document.addEventListener("pointerup", () => { pointerDown = false; }, true);
  root.addEventListener("change", (ev) => {
    if (!ev.target.dataset.comment) return;
    if (!pointerDown) return render();
    let done = false;
    const later = () => { if (done) return; done = true; document.removeEventListener("pointerup", later, true); setTimeout(render, 0); };
    document.addEventListener("pointerup", later, true);
    setTimeout(later, 1500);
  });
  root.addEventListener("toggle", (ev) => { const d = ev.target; if (d.dataset && d.dataset.lane in S.lanes) S.lanes[d.dataset.lane] = d.open; }, true);
  root.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (t.getAttribute("role") === "tab" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
      const tabs = [...root.querySelectorAll('[role="tab"]')], k = tabs.indexOf(t);
      tabs[(k + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].focus(); ev.preventDefault(); return;
    }
    if (t.tagName === "TR" && t.dataset.open) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); return openItem(t.dataset.open, t); }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { const s = ev.key === "ArrowDown" ? t.nextElementSibling : t.previousElementSibling; if (s) s.focus(); ev.preventDefault(); return; }
      if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && t.hasAttribute("data-exp")) { if (ev.key === "ArrowLeft") S.collapsed.add(t.dataset.open); else S.collapsed.delete(t.dataset.open); ev.preventDefault(); return render(); }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (S.helpOpen) { S.helpOpen = false; render(); const b = document.querySelector('[data-k="help"]'); if (b) b.focus(); return; }
      if (S.agendaOpen) { S.agendaOpen = false; render(); const b = document.querySelector('[data-k="agenda"]'); if (b) b.focus(); return; }
      if (S.marksOpen) return closeMarks();
      // Escape в форме закрытия отменяет только форму; в полях ввода карточку не закрывает [Р-72]
      if (S.closeForm) { S.closeForm = null; render(); const b = document.querySelector('[data-k="st-Закрыто"]'); if (b) b.focus(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (S.selected) closePanel();
      return;
    }
    if (ev.key === "Tab" && (S.agendaOpen || S.helpOpen || S.marksOpen)) {
      const m = document.querySelector(".modal"); if (!m) return;
      const f = [...m.querySelectorAll("button, textarea")], first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
      else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
    }
  });

  // Печать всегда в светлой теме [Р-63]
  window.addEventListener("beforeprint", () => { document.documentElement.setAttribute("data-theme", "light"); });
  window.addEventListener("afterprint", () => { document.documentElement.setAttribute("data-theme", theme); });
  // Параметры item, who, sec [Р-66]
  if (q.has("item")) { const n = q.get("item"); if (SEED.items.some((i) => i.num === n)) S.selected = n; else notices.push("Параметр item не распознан: работа с таким номером не найдена."); }
  if (q.has("who") && !orgKey) { const w = q.get("who"); if (own(OWNER_F, w)) S.filters.owner = w; else notices.push("Параметр who не распознан, отбор по участнику не применён."); }
  if (q.has("sec")) { const c = q.get("sec"); if (["1", "2.1", "2.2", "3"].includes(c)) S.filters.section = c; else notices.push("Параметр sec не распознан, отбор по разделу не применён."); }
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if ((view === "summary" || view === "milestones") && !S.agendaOpen && !S.marksOpen) render(); }, 150); });

  if (!SEED || !Array.isArray(SEED.items) || !SEED.items.length) { root.innerHTML = `<div class="empty" role="alert"><p>Данные План-графика не загружены. Страница не может построить отображение. Обратитесь к руководителю проекта.</p></div>`; return; }
  render();
  window.__orbita = { get model() { return M; }, setView, openItem };
