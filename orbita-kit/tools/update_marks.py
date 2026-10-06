"""Перенос отметок вкладки «Важное» в data/seed_ymg_stage1.json (Р-75).

Изменяются только поля, которые питает «Важное»: status, status_mark, closed_date,
control_date, horizon; у проекта — demo_today (дата отметок), source и примечание о дате.
Наименования, сроки, исполнители, документы и примечания План-графика не трогаются.

Отметка переводится в статус словаря по таблице MARK_STATUS. Неизвестная отметка —
ошибка: статус не угадывается. «Срок прошел ДД.ММ.ГГГГ» не называет стадию работы,
поэтому статус сохраняется из предыдущей редакции, а текст отметки обновляется.

Запуск:
  python3 tools/update_marks.py --xlsx source/<файл>.xlsx --edition 2026-10-06 [--write]
  python3 tools/update_marks.py --xlsx <прежняя книга> --edition 2026-09-28 --check   # сверка без записи
"""
import argparse
import datetime as dt
import json
import re
import sys
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "data/seed_ymg_stage1.json"

CLOSED, KEEP = "Закрыто", None
# Текст отметки (без концевых пробелов) → статус словаря. Строки 1–13 — редакция 28.09.2026, 14–19 — 06.10.2026.
MARK_STATUS = {
    "Получен документ": CLOSED,
    "Письмо отправлено": CLOSED,
    "Принято": CLOSED,
    "Аванс ушел 31.08.2026": CLOSED,
    "Подписание": CLOSED,
    "Согласовано": CLOSED,
    "Закрывается исполнителем (без нашего участия)": CLOSED,
    "Решить проблему с размещением, ждем пакет документов на согласование": "Ожидаем документ",
    "Документ не получили": "Ожидаем документ",
    "Идет процесс, срок 30.09.2026": "В работе",
    "Ждем, финальная проработка документов": "На согласовании",
    "Подготовка материалов": "Подготовка материалов",
    "Подготовка материалов, ждем финальную версию": "Подготовка материалов",
    "Принято, замечания отработаны": CLOSED,
    "Запуск конкурса и информирвоание по результатам": "В работе",
    "Процесс согласования документов": "На согласовании",
    "Взяли в работу": "В работе",
    "В работе": "В работе",
}
LAPSE = re.compile(r"^Срок прош[её]л \d{2}\.\d{2}\.\d{4}$")
SECTIONS = [("СРОЧНЫЕ", "Срочно"), ("СРЕДНЕСРОЧНЫЕ", "1 месяц"), ("НЕСРОЧНЫЕ", "2 месяца"), ("Справочно", "Справочно"), ("ЗАКРЫТЫЕ", "Закрыто")]
FIELDS = ("status", "status_mark", "closed_date", "control_date", "horizon")


def txt(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    s = txt(v)
    m = re.fullmatch(r"(\d{2})\.(\d{2})\.(\d{4})", s)
    return f"{m[3]}-{m[2]}-{m[1]}" if m else None


def read_rows(xlsx):
    """Строки «Важного» с номером пункта: (номер, раздел, отметка, дата передачи, номер строки)."""
    ws = openpyxl.load_workbook(xlsx, data_only=True)["Важное"]
    section, rows = None, []
    for r in range(1, ws.max_row + 1):
        a = txt(ws.cell(r, 1).value)
        hit = next((h for key, h in SECTIONS if a.startswith(key)), None)
        if hit:
            section = hit
            continue
        if re.fullmatch(r"\d+(\.\d+)*\.?", a):
            rows.append((a.rstrip("."), section, txt(ws.cell(r, 7).value), iso(ws.cell(r, 6).value), r))
    return rows


def plan(seed, rows):
    """Новые значения полей по строкам «Важного»; повтор пункта разрешается в пользу строки вне «Закрытых»."""
    by = {i["num"]: i for i in seed["items"]}
    chosen, notes = {}, []
    for row in rows:
        num = row[0]
        if num not in by:
            raise SystemExit(f"Пункт {num} (строка {row[4]}) отсутствует в План-графике")
        if num in chosen:
            prev = chosen[num]
            keep = row if prev[1] == "Закрыто" and row[1] != "Закрыто" else prev
            notes.append(f"п. {num}: две строки ({prev[4]} «{prev[2]}», {row[4]} «{row[2]}») — принята строка {keep[4]} вне раздела «Закрытые работы»")
            chosen[num] = keep
        else:
            chosen[num] = row
    out = {}
    for num, (_, section, mark, transfer, r) in chosen.items():
        if not mark:  # работа в горизонте «Важного» без отметки: меняется только раздел
            out[num] = {"status_mark": None, "closed_date": None, "control_date": transfer, "horizon": section}
            continue
        if mark in MARK_STATUS:
            status = MARK_STATUS[mark]
        elif LAPSE.match(mark):
            status = KEEP
        else:
            raise SystemExit(f"п. {num} (строка {r}): отметка «{mark}» отсутствует в таблице MARK_STATUS — дополните таблицу решением")
        status = status or by[num]["status"]
        closed = status == CLOSED
        out[num] = {"status": status, "status_mark": mark, "closed_date": transfer if closed else None,
                    "control_date": None if closed else transfer, "horizon": section}
    return out, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--edition", required=True, help="дата отметок, ГГГГ-ММ-ДД")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true", help="сверить с текущими данными без записи")
    a = ap.parse_args()
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    new, notes = plan(seed, read_rows(a.xlsx))
    diffs = []
    # Пункты вне «Важного»: отметок и дат передачи нет, статус не меняется
    absent = {"status_mark": None, "closed_date": None, "control_date": None, "horizon": None}
    for i in seed["items"]:
        want = new.get(i["num"], absent)
        diffs += [(i["num"], f, i[f], want[f]) for f in FIELDS if f in want and i[f] != want[f]]
    for n in notes:
        print("ПОВТОР:", n)
    for num, f, old, v in diffs:
        print(f"{num:9} {f:13} {old!r} → {v!r}")
    print(f"Изменений полей: {len(diffs)}")
    if a.check:
        sys.exit(1 if diffs else 0)
    if not a.write:
        return
    for i in seed["items"]:
        i.update(new.get(i["num"], absent))
    ed = dt.date.fromisoformat(a.edition)
    old_ed = dt.date.fromisoformat(seed["project"]["demo_today"])
    seed["project"]["demo_today"] = a.edition
    seed["source"] = re.sub(r"редакция на \d{2}\.\d{2}\.\d{4}", f"редакция на {ed:%d.%m.%Y}", seed["source"])
    seed["notes"] = [n.replace(f"{old_ed:%d.%m.%Y}", f"{ed:%d.%m.%Y}") for n in seed["notes"]]
    SEED_PATH.write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding="utf-8")  # формат исходного файла
    print("Записано:", SEED_PATH.relative_to(ROOT))


if __name__ == "__main__":
    main()
