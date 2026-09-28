"""Карта данных seed_ymg_stage1.json: граф для graphify и аналитические срезы.

Детерминированный экстрактор предметной модели. Рёбра:
  EXTRACTED — поле JSON или явная ссылка «поз. N» с совпадающей датой;
  INFERRED  — логическая зависимость, выведенная из наименований/примечаний;
  AMBIGUOUS — ссылка на устаревшую нумерацию или спорное направление связи.
Запуск: python3 tools/data_map.py [--extract graphify-out/.graphify_extract.json]
"""
import collections
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = "data/seed_ymg_stage1.json"
D = json.loads((ROOT / SRC).read_text(encoding="utf-8"))
ITEMS = D["items"]
BY = {i["num"]: i for i in ITEMS}
TODAY = dt.date.fromisoformat(D["project"]["demo_today"])

# Нерабочие дни в окне этапа (ТК РФ ст. 112; перенос 04.01.2026 → 31.12.2026).
HOLIDAYS = {dt.date(2026, 11, 4), dt.date(2026, 12, 31)} | {dt.date(2027, 1, d) for d in range(1, 9)}


def d(s):
    return dt.date.fromisoformat(s) if s else None


def workdays(a, b):
    """Рабочие дни в полуинтервале (a, b]."""
    n, x = 0, a
    while x < b:
        x += dt.timedelta(days=1)
        if x.weekday() < 5 and x not in HOLIDAYS:
            n += 1
    return n


def nid(num):
    return "poz_" + num.replace(".", "_")


# ── Кандидаты в зависимости (кураторский перечень с обоснованием)
DEPS = [
    # (от, к, уверенность, оценка, основание)
    ("2.2.1", "2.2.6", "EXTRACTED", 1.0, "execution_doc 2.2.1: «приёмка — поз. 2.2.6»"),
    ("2.2.2", "2.2.7", "EXTRACTED", 1.0, "execution_doc и plan_note 2.2.2: «приёмка — поз. 2.2.7 (27.11.2026)»"),
    ("2.2.5.2", "2.2.5.4", "EXTRACTED", 1.0, "plan_note 2.2.5.4: демонстрация после сборки ЛО (поз. 2.2.5.2, 20.11.2026)"),
    ("2.2.5.2", "2.2.5.3", "EXTRACTED", 1.0, "plan_note 2.2.5.2: сборка перенесена, исследования ЛО — 27.11.2026"),
    ("3.8", "3.2", "EXTRACTED", 1.0, "plan_note 3.8: акт инвентаризации — в составе ФОД (поз. 3.2)"),
    ("1.4", "3.2", "INFERRED", 0.95, "output_doc 3.2 включает «документы, подтверждающие внесение сведений в ЕГИСУ НИОКТР»"),
    ("2.1.4", "2.1.6", "INFERRED", 0.95, "plan_note 2.1.4: «согласованное ТЗ на СЧ ОКР → заключение договора» (номер в тексте устаревший)"),
    ("2.1.5", "2.1.6", "INFERRED", 0.95, "ТЗ ИХС — приложение к договору с соисполнителем (plan_note 2.1.6)"),
    ("2.1.6", "2.2.1", "INFERRED", 0.95, "plan_note 2.2.1: договор с соисполнителем заключается в сентябре 2026 г."),
    ("2.1.6", "2.2.2", "INFERRED", 0.95, "работы ИХС ведутся по договору и ТЗ из 2.1.6"),
    ("2.1.7", "2.1.6", "INFERRED", 0.85, "2.1.6 включает договоры с поставщиками; предложение цепочки BRIEF.md"),
    ("2.1.7", "2.2.5.1", "INFERRED", 0.85, "МТР (ПКИ и материалы для ЛО ЯМГ, лист «Оборудование и Сырье») → изготовление макетов"),
    ("2.1.7", "2.2.5.2", "INFERRED", 0.85, "ПКИ для изготовления ЛО ЯМГ → сборка ЛО"),
    ("2.1.9", "2.2.5.3", "INFERRED", 0.95, "2.2.5.3: испытания «по согласованной с Заказчиком программе и методике»"),
    ("2.2.5.4", "2.2.5.5", "INFERRED", 0.95, "приглашение предшествует демонстрации"),
    ("2.2.5.3", "2.2.5.5", "INFERRED", 0.85, "демонстрация в рамках исследований (plan_note 2.2.5.4)"),
    ("2.2.5.1", "2.2.4.1", "INFERRED", 0.95, "2.2.4.1: «выбор варианта обработки … по результатам экспериментов» (эксперименты — 2.2.5.1)"),
    ("2.2.2", "2.2.5.1", "INFERRED", 0.75, "технологические операции изготовления ячеек (ИХС) → изготовление макетов ячеек"),
    ("2.2.2", "2.2.4.1", "AMBIGUOUS", 0.3, "звено цепочки BRIEF.md; срок 2.2.4.1 (06.11) раньше срока 2.2.2 (16.11)"),
    ("2.2.4.1", "2.2.5.1", "AMBIGUOUS", 0.3, "звено цепочки BRIEF.md; по наименованиям связь обратная (2.2.5.1 → 2.2.4.1)"),
    ("2.2.5.1", "2.2.5.2", "INFERRED", 0.85, "макеты ячеек и выбор обработки → сборка ЛО"),
    ("2.1.2", "2.2.3", "INFERRED", 0.85, "принципиальная схема → математическая модель"),
    ("2.1.2", "2.2.4", "INFERRED", 0.85, "принципиальная схема → КД технического проекта"),
    ("2.1.2", "2.1.9", "EXTRACTED", 1.0, "plan_note 2.1.9: ПМИ согласуются одновременно с ПЗ (поз. 2.1.2, 30.09.2026)"),
    ("2.1.8", "2.2.4", "INFERRED", 0.85, "технические требования на СЧ ИИМ → КД на составные части"),
    ("2.1.3", "2.2.8", "INFERRED", 0.85, "перечень-комплектность документации → выпуск комплекта ТП"),
    ("2.2.3", "2.2.8", "INFERRED", 0.85, "ПЗ с описанием модели входит в комплект ТП"),
    ("2.2.4", "2.2.8", "INFERRED", 0.85, "КД входит в комплект ТП"),
    ("2.2.5", "2.2.8", "INFERRED", 0.85, "протокол испытаний ЛО — основание оценки характеристик"),
    ("2.2.9", "2.2.8", "INFERRED", 0.85, "уточнённые параметры — в составе ПЗ к ТП"),
    ("2.2.6", "2.2.8", "INFERRED", 0.75, "заключения о приёмке работ соисполнителей — в отчётности по этапу"),
    ("2.2.7", "2.2.8", "INFERRED", 0.75, "заключения о приёмке работ соисполнителей — в отчётности по этапу"),
    ("2.2.8", "3.1", "INFERRED", 0.95, "комплект ТП передаётся как НТ отчётные материалы"),
    ("2.2.10", "3.1", "INFERRED", 0.75, "уведомление о готовности предшествует передаче материалов"),
    ("3.1", "3.9", "INFERRED", 0.95, "приёмка НТ отчётных материалов комиссией"),
    ("3.9", "3.11", "INFERRED", 0.95, "устранение замечаний — при наличии замечаний комиссии"),
    ("3.2", "3.10", "INFERRED", 0.95, "приёмка сопроводительных документов"),
    ("3.9", "3.12", "INFERRED", 0.95, "Акт сдачи-приёмки после приёмки ТП"),
    ("3.10", "3.12", "INFERRED", 0.95, "Акт сдачи-приёмки после приёмки финансовой отчётности"),
    ("3.11", "3.12", "INFERRED", 0.85, "условный цикл замечаний предшествует Акту"),
    ("2.1.1", "3.7", "INFERRED", 0.65, "патентные исследования → перечень РИД"),
]
# Смысловая преемственность «обоснование схемы → проектирование»
LINEAGE = [
    ("2.1.2.1", "2.2.3.1", "рабочие вещества → модель динамики спинов"),
    ("2.1.2.3", "2.2.3.2", "состав смеси → модель изотопного сдвига"),
    ("2.1.2.3", "2.2.3.3", "состав смеси → расчёт изотопного состава ксенона"),
    ("2.1.2.4", "2.2.4.2", "схема магнитной системы → КД магнитной системы"),
    ("2.1.2.2", "2.2.4.3", "выбор VCSEL → КД оптического блока"),
    ("2.1.2.5", "2.2.3.4", "контур обратной связи → модель контура"),
]
# Ссылки plan_note на устаревшую нумерацию (до объединения позиций 18.08.2026)
STALE = [
    ("2.1.4", "2.1.5", "«согласование с Заказчиком — 11.09.2026 (поз. 2.1.5)»: 2.1.5 — ТЗ ИХС со сроком 04.09"),
    ("2.1.4", "2.1.7", "«заключение договора с соисполнителем (поз. 2.1.7)»: договоры — 2.1.6"),
    ("2.1.6", "2.1.7", "«Позиции 2.1.7 и 2.1.8 объединены»: прежняя нумерация"),
    ("2.2.1", "2.1.5", "«договор с соисполнителем … (поз. 2.1.5)»: договоры — 2.1.6"),
    ("2.2.5", "2.2.5.4", "«Подпозиция 2.2.5.4 (оформление ПЗ) укрупнена»: текущая 2.2.5.4 — приглашение"),
]


def short(s, n=48):
    s = re.sub(r"\s+", " ", s)
    return s if len(s) <= n else s[: n - 1] + "…"


def build_extract():
    nodes, edges, hyper = [], [], []
    loc = {i["num"]: f"items[{k}]" for k, i in enumerate(ITEMS)}

    def node(i, label, ft="concept", src=SRC, sl=None):
        nodes.append(dict(id=i, label=label, file_type=ft, source_file=src, source_location=sl,
                          source_url=None, captured_at=None, author=None, contributor=None))

    def edge(a, b, rel, conf="EXTRACTED", score=1.0, sl=None, note=None):
        e = dict(source=a, target=b, relation=rel, confidence=conf, confidence_score=score,
                 source_file=SRC, source_location=sl, weight=1.0)
        if note:
            e["rationale"] = note
        edges.append(e)

    node("proekt_ymg_iim", "ОКР «ЯМГ-ИИМ», этап 1", "document", sl="project")
    orgs = collections.OrderedDict()
    for it in ITEMS:
        for o in it["owners"]:
            orgs.setdefault(o, "org_" + re.sub(r"[^a-z0-9]+", "_", o.encode("ascii", "ignore").decode().lower()).strip("_"))
    translit = {"Электроприбор": "org_elektropribor", "СП «Квант»": "org_sp_kvant",
                "ФТИ им. Иоффе": "org_fti_ioffe", "ИХС им. Гребенщикова": "org_ihs_grebenshchikov"}
    for o in orgs:
        node(translit[o], o, "concept", sl="items[].owners")
    for it in ITEMS:
        tag = {"section": "Раздел", "group": "Группа", "task": "Поз."}[it["kind"]]
        node(nid(it["num"]), f"{it['num']} {short(it['name'])}", "document", sl=loc[it["num"]])
        parent = nid(it["parent"]) if it["parent"] else "proekt_ymg_iim"
        edge(parent, nid(it["num"]), "contains", sl=loc[it["num"]])
        for o in it["owners"]:
            edge(nid(it["num"]), translit[o], "assigned_to", sl=loc[it["num"]] + ".owners")
    for m in D["milestones"]:
        mid = "veha_" + m["date"].replace("-", "_")
        node(mid, f"Веха {dt.date.fromisoformat(m['date']).strftime('%d.%m.%Y')}: {short(m['title'], 40)}", "concept", sl="milestones")
        edge("proekt_ymg_iim", mid, "has_milestone", sl="milestones")
        for it in ITEMS:
            if it["kind"] == "section":
                continue
            if m["date"] in (it["due"], it["due_to_customer"]):
                edge(nid(it["num"]), mid, "due_at", sl=loc[it["num"]])
    # Основания включения: пункты Договора и ТЗ
    basis_nodes = {}
    for it in ITEMS:
        b = it["basis"] or ""
        for doc, body in re.findall(r"(Договор[а]?|ТЗ)\s*\(([^)]*)\)", b):
            for cl in re.findall(r"\d+(?:\.\d+)*(?:\s*[а-я]\))?", body):
                key = ("Договор" if doc.startswith("Договор") else "ТЗ") + " п. " + cl.replace(" ", "")
                basis_nodes.setdefault(key, [])
                basis_nodes[key].append(it["num"])
        for m in re.finditer(r"п\.\s*(\d+(?:\.\d+)*(?:\s*[а-я]\))?)\s*Договора", b):
            key = "Договор п. " + m.group(1).replace(" ", "")
            basis_nodes.setdefault(key, []).append(it["num"])
        if re.search(r"(^|;\s*)М(\s*;|$)", b) or b.strip() == "М":
            basis_nodes.setdefault("Основание «М» (не расшифровано)", []).append(it["num"])
    for key, nums in basis_nodes.items():
        bid = "osnovanie_" + re.sub(r"[^a-z0-9]+", "_", key.encode("ascii", "ignore").decode().lower()).strip("_")
        bid += "_" + ("dogovor" if key.startswith("Договор") else "tz" if key.startswith("ТЗ") else "m")
        bid += "_" + re.sub(r"[^0-9ab]+", "_", key.replace("а)", "a").replace("б)", "b")).strip("_")
        node(bid, key, "concept", sl="items[].basis")
        for n in sorted(set(nums)):
            edge(nid(n), bid, "cites", sl=loc[n] + ".basis")
    for a, b, conf, sc, why in DEPS:
        edge(nid(a), nid(b), "depends_on" if conf != "AMBIGUOUS" else "chain_link_disputed", conf, sc, loc[b], why)
    for a, b, why in LINEAGE:
        edge(nid(a), nid(b), "conceptually_related_to", "INFERRED", 0.85, loc[b], why)
    for a, b, why in STALE:
        edge(nid(a), nid(b), "references_stale_number", "AMBIGUOUS", 0.2, loc[a] + ".plan_note", why)
    chain = D["critical_chain"]
    for a, b in zip(chain, chain[1:]):
        edge(nid(a), nid(b), "critical_chain_next", "EXTRACTED", 1.0, "critical_chain", "аналитическое предложение (notes[4])")
    # Гиперрёбра: гроздья сроков ≥ 5 позиций, цепочка, «Нет отметки»
    by_due = collections.defaultdict(list)
    for it in ITEMS:
        if it["kind"] != "section" and it["due"]:
            by_due[it["due"]].append(it["num"])
    for day, nums in sorted(by_due.items()):
        if len(nums) >= 5:
            hyper.append(dict(id="srok_" + day.replace("-", "_"), label=f"Срок {d(day).strftime('%d.%m.%Y')}: {len(nums)} поз.",
                              nodes=[nid(n) for n in nums], relation="form", confidence="EXTRACTED",
                              confidence_score=1.0, source_file=SRC))
    hyper.append(dict(id="kriticheskaya_cepochka_lo", label="Критическая цепочка ЛО (предложение)",
                      nodes=[nid(n) for n in chain] + [nid("2.1.9")], relation="participate_in",
                      confidence="EXTRACTED", confidence_score=1.0, source_file=SRC))
    hyper.append(dict(id="net_otmetki", label="«Нет отметки» при наступившем сроке",
                      nodes=[nid(i["num"]) for i in ITEMS if i["status"] == "Нет отметки"], relation="form",
                      confidence="EXTRACTED", confidence_score=1.0, source_file=SRC))
    # Пары с несколькими отношениями сводятся в одно ребро: приоритет — звено цепочки,
    # затем зависимость; прочие отношения сохраняются в also_relations.
    prio = {"critical_chain_next": 0, "depends_on": 1, "chain_link_disputed": 2, "contains": 3}
    merged = {}
    for e in edges:
        k = (e["source"], e["target"])
        if k not in merged:
            merged[k] = e
            continue
        a, b = sorted((merged[k], e), key=lambda x: prio.get(x["relation"], 9))
        a.setdefault("also_relations", []).append(b["relation"])
        if b["relation"] == "chain_link_disputed":
            a["confidence"], a["confidence_score"] = b["confidence"], b["confidence_score"]
        if b.get("rationale"):
            a["rationale"] = "; ".join(filter(None, (a.get("rationale"), b["rationale"])))
        merged[k] = a
    return dict(nodes=nodes, edges=list(merged.values()), hyperedges=hyper, input_tokens=0, output_tokens=0)


def analytics():
    A = {}
    kinds = collections.Counter(i["kind"] for i in ITEMS)
    A["kinds"] = dict(kinds)
    work = [i for i in ITEMS if i["kind"] != "section"]
    leaves = [i for i in ITEMS if i["kind"] == "task"]
    top = [i for i in work if i["level"] <= 3 and (i["parent"] and BY[i["parent"]]["kind"] == "section")]
    A["denominators"] = {"задачи (листья)": len(leaves), "задачи+группы": len(work), "позиции верхнего уровня (без подпозиций)": len(top)}
    closed = [i["num"] for i in work if i["status"] == "Закрыто"]
    A["closed"] = closed
    A["closed_share"] = {k: f"{len([c for c in closed if c in {x['num'] for x in S}])}/{len(S)}"
                         for k, S in (("листья", leaves), ("задачи+группы", work), ("верхний уровень", top))}
    A["status_all"] = dict(collections.Counter(str(i["status"]) for i in work))
    A["status_by_kind"] = {k: dict(collections.Counter(str(i["status"]) for i in work if i["kind"] == k)) for k in ("task", "group")}
    A["horizon_json"] = dict(collections.Counter(str(i["horizon"]) for i in work))
    sec = collections.defaultdict(collections.Counter)
    for i in work:
        s = i["num"].split(".")[0] if i["num"].split(".")[0] != "2" else ".".join(i["num"].split(".")[:2])
        sec[s][i["status"] or "—"] += 1
    A["status_by_section"] = {k: dict(v) for k, v in sorted(sec.items())}
    own = collections.Counter()
    own_solo = collections.Counter()
    for i in work:
        for o in i["owners"]:
            own[o] += 1
        own_solo[" + ".join(i["owners"])] += 1
    A["owners_participation"] = dict(own)
    A["owners_combination"] = dict(own_solo)
    A["multi_owner"] = [(i["num"], len(i["owners"])) for i in work if len(i["owners"]) > 1]
    # Даты
    by_due = collections.Counter(i["due"] for i in leaves)
    A["due_peaks_leaves"] = [(k, v) for k, v in by_due.most_common() if v >= 3]
    by_due_all = collections.Counter(i["due"] for i in work)
    A["due_peaks_work"] = [(k, v) for k, v in by_due_all.most_common() if v >= 3]
    wk = collections.Counter()
    for i in leaves:
        y, w, _ = d(i["due"]).isocalendar()
        wk[f"{y}-W{w:02d}"] += 1
    A["weekly_leaves"] = dict(sorted(wk.items()))
    mon = collections.Counter(i["due"][:7] for i in leaves)
    A["monthly_leaves"] = dict(sorted(mon.items()))
    A["due_vs_customer"] = [(i["num"], i["due"], i["due_to_customer"], (d(i["due_to_customer"]) - d(i["due"])).days)
                            for i in work if i["due_to_customer"] and i["due_to_customer"] != i["due"]]
    A["no_due_to_customer"] = [i["num"] for i in work if not i["due_to_customer"]]
    A["control_dates"] = [(i["num"], i["due"], i["control_date"], i["status"]) for i in work if i["control_date"]]
    A["closed_dates"] = [(i["num"], i["due"], i["closed_date"], (d(i["closed_date"]) - d(i["due"])).days if i["closed_date"] else None) for i in work if i["status"] == "Закрыто"]
    # Срез на demo_today
    open_ = [i for i in work if i["status"] != "Закрыто"]
    A["overdue_due"] = [(i["num"], i["kind"], i["status"], (TODAY - d(i["due"])).days) for i in open_ if d(i["due"]) < TODAY]
    A["overdue_control"] = [(i["num"], i["control_date"], (TODAY - d(i["control_date"])).days) for i in open_ if i["control_date"] and d(i["control_date"]) < TODAY]
    A["le7"] = [i["num"] for i in open_ if 0 <= (d(i["due"]) - TODAY).days <= 7]
    hz = collections.defaultdict(list)
    for i in open_:
        k = (d(i["due"]) - TODAY).days
        b = "просрочено" if k < 0 else "0–14" if k <= 14 else "15–30" if k <= 30 else "31–60" if k <= 60 else ">60"
        hz[b].append(i["num"])
    A["horizons_computed"] = {k: (len(v), v) for k, v in hz.items()}
    # Производные даты начала: проверка правила notes[3]
    anomalies = []
    for i in ITEMS:
        if i["kind"] == "task" and i["parent"] and BY[i["parent"]]["kind"] == "group":
            sib = [x for x in ITEMS if x["parent"] == i["parent"]]
            k = sib.index(i)
            exp = D["project"]["stage_start"] if k == 0 and i["parent"].startswith("2.1") else (
                "2026-10-01" if k == 0 else (d(sib[k - 1]["due"]) + dt.timedelta(days=1)).isoformat())
            if i["start"] != exp:
                anomalies.append((i["num"], "start", i["start"], "по правилу", exp))
    A["start_rule_anomalies"] = anomalies
    A["start_all_derived"] = all(i["start_derived"] for i in ITEMS)
    A["name_len"] = sorted(((len(i["name"]), i["num"]) for i in ITEMS), reverse=True)[:5]
    A["output_doc_len_max"] = max((len(i["output_doc"] or ""), i["num"]) for i in ITEMS)
    A["plan_note_len_max"] = max((len(i["plan_note"] or ""), i["num"]) for i in ITEMS)
    A["field_fill"] = {k: sum(1 for i in work if i[k]) for k in
                       ("output_doc", "execution_doc", "basis", "plan_note", "due_to_customer", "status_mark", "control_date", "closed_date", "comment")}
    A["group_status"] = {i["num"]: (i["status"], [BY[x["num"]]["status"] for x in ITEMS if x["parent"] == i["num"]]) for i in ITEMS if i["kind"] == "group"}
    A["section_due"] = {i["num"]: (i["start"], i["due"], max(x["due"] for x in ITEMS if x["num"].startswith(i["num"] + ".") and x["due"])) for i in ITEMS if i["kind"] == "section"}
    # Цепочка: окна между сроками звеньев (кал. / раб. дни)
    ch = D["critical_chain"]
    A["chain_windows"] = [(a, BY[a]["due"], b, BY[b]["due"], (d(BY[b]["due"]) - d(BY[a]["due"])).days,
                           workdays(d(BY[a]["due"]), d(BY[b]["due"])) if d(BY[b]["due"]) > d(BY[a]["due"]) else None)
                          for a, b in zip(ch, ch[1:])]
    A["chain_flag_mismatch"] = sorted(set(i["num"] for i in ITEMS if i["critical_chain"]) ^ set(ch))
    # Окна приёмки
    A["acceptance"] = {
        "2.2.6/2.2.7: 16.11 → 27.11": ((d("2026-11-27") - d("2026-11-16")).days, workdays(d("2026-11-16"), d("2026-11-27"))),
        "3.1 (01.12) → 3.9 (30.12)": ((d("2026-12-30") - d("2026-12-01")).days, workdays(d("2026-12-01"), d("2026-12-30"))),
        "окончание этапа 30.12 + 10 раб. дн. (3.2)": str(next(x for x in (d("2026-12-30") + dt.timedelta(days=k) for k in range(1, 40)) if workdays(d("2026-12-30"), x) == 10)),
        "1.1: 13.08 + 10 раб. дн.": str(next(x for x in (d("2026-08-13") + dt.timedelta(days=k) for k in range(1, 40)) if workdays(d("2026-08-13"), x) == 10)),
        "1.2: 13.08 + 15 раб. дн.": str(next(x for x in (d("2026-08-13") + dt.timedelta(days=k) for k in range(1, 40)) if workdays(d("2026-08-13"), x) == 15)),
        "3.3: 20-й раб. день октября": str([x for x in (d("2026-09-30") + dt.timedelta(days=k) for k in range(1, 32)) if workdays(d("2026-09-30"), x) == 20][0]),
    }
    return A


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--extract":
        Path(sys.argv[2]).write_text(json.dumps(build_extract(), ensure_ascii=False, indent=1), encoding="utf-8")
        print("extract written")
    else:
        json.dump(analytics(), sys.stdout, ensure_ascii=False, indent=1, default=str)
