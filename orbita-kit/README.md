# Орбита · ЯМГ-ИИМ · Этап 1

Презентационный прототип онлайн-планера статуса реализации ОКР «ЯМГ-ИИМ» (этап 1, 71 позиция План-графика).

## Как открыть
- Опубликованная версия: https://klemmerpavel-beep.github.io/quantum-sensor-scheduler/ — В1 «Панель», выбрана заказчиком (Р-55).
- Сравнение версий: https://klemmerpavel-beep.github.io/quantum-sensor-scheduler/versions/
- Локально: `index.html` открывается двойным щелчком, без сервера и сборки.

Картина на дату редакции План-графика: добавьте `?today=2026-09-28`.

| Параметр | Назначение |
|---|---|
| `?view=summary\|gantt\|focus\|board\|milestones` | режим при открытии |
| `?view=exec` | «Сводка» для руководства, только просмотр |
| `?org=elektropribor\|fti\|ihs` | выборка исполнителя, только просмотр |
| `?theme=dark` | тёмная тема |

## Состав
| Путь | Содержание |
|---|---|
| `data/seed_ymg_stage1.json`, `source/*.xlsx` | исходные данные (не изменяются) |
| `src/` | исходники страницы: стили, модуль расчёта, интерфейс, шаблон |
| `tools/build.py` | сборка версий: `python3 tools/build.py [--index v1\|v2\|v3]` |
| `docs/` | карта данных, свод решений, совет, спецификация, UX, токены, приёмка |
| `tests/` | проверки в Playwright: `node tests/behaviour.js`, `node tests/shots.js`, `node tests/targets.js`, `node tests/latin.js` |
| `screenshots/` | снимки режимов и стресс-сценариев |

## Публикация
1. Сборка: `python3 tools/build.py`.
2. В ветку `gh-pages` в корень копируются `index.html` и `versions/`.
3. Исходники и документация в `gh-pages` не входят (Р-57).
