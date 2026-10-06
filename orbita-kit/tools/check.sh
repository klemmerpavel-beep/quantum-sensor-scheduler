#!/usr/bin/env bash
# Полная проверка перед публикацией (ARCHITECTURE.md §6). Запуск: bash tools/check.sh
# Необязательно: AXE=/путь/к/axe.min.js — аудит доступности; SHOTS=0 — без снимков.
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n── %s\n' "$1"; }

step "Исходные данные не изменены"
# Редакция 06.10.2026 (Р-75) и архив редакции 28.09.2026
echo "b451c9f7325b051a8023cc270b1f437e  data/seed_ymg_stage1.json" | md5sum -c --quiet
echo "4c0c37f3c73a93046fff02784dc5c7bb  source/План-график_этап1_ЯМГ-ИИМ.xlsx" | md5sum -c --quiet
echo "a3be5514489c1146f9ef1c1ec9832fa4  data/archive/seed_ymg_stage1_2026-09-28.json" | md5sum -c --quiet
echo "32e6c26b8f30bd8fb0047be8925b32e9  source/archive/2026-09-28_План-график_этап1_ЯМГ-ИИМ.xlsx" | md5sum -c --quiet
echo "OK"

step "Отметки «Важного» перенесены в данные без расхождений"
ED=$(python3 -c 'import json; print(json.load(open("data/seed_ymg_stage1.json"))["project"]["demo_today"])')
python3 tools/update_marks.py --xlsx "source/План-график_этап1_ЯМГ-ИИМ.xlsx" --edition "$ED" --check | tail -1

step "Сверка данных с План-графиком"
python3 tools/reconcile.py | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["order_identical"] and not d["plan_diffs"] and not d["json_missing_in_plan"], d; print("расхождений нет:", d["json_items"], "позиций")'

step "Сборка"
python3 tools/build.py

step "Правила расчёта"
node tests/engine.test.js | tail -1

step "Поведение в браузере"
node tests/behaviour.js | tail -1

step "Зоны нажатия, латиница, контраст"
node tests/targets.js
node tests/latin.js
python3 tools/contrast.py

if [ -n "${AXE:-}" ]; then step "Доступность (axe-core)"; node tests/a11y.js | tail -1; fi
if [ "${SHOTS:-1}" != "0" ]; then step "Снимки"; node tests/shots.js | tail -1; fi

printf '\nВсе проверки пройдены.\n'
