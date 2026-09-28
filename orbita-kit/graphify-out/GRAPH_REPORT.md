# Graph Report - orbita-kit  (2026-09-28)

## Corpus Check
- Corpus is ~18,754 words - fits in a single context window. You may not need a graph.

## Summary
- 118 nodes · 310 edges · 7 communities
- Extraction: 87% EXTRACTED · 11% INFERRED · 2% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Патентные исследования, схема, модель
- Сдача этапа и финансовая отчётность
- Соисполнители и отчётность ТП
- Запуск договора
- КД и изготовление ЛО
- Испытания и демонстрация ЛО
- ТЗ соисполнителей, участие Заказчика

## God Nodes (most connected - your core abstractions)
1. `Электроприбор` - 63 edges
2. `Основание «М» (не расшифровано)` - 19 edges
3. `2.2.8 Подготовка отчетной документации по этапу (в то…` - 15 edges
4. `2.1.2 Выбор и обоснование принципиальной схемы кванто…` - 14 edges
5. `2.1.6 Формирование и выдача технических заданий соисп…` - 13 edges
6. `3 Сдача этапа 1` - 13 edges
7. `2.1.1 Патентные исследования по направлению работ` - 12 edges
8. `2.2.3 Выполнение технического проектирования ИИМ: соз…` - 12 edges
9. `2.2.4 Выполнение технического проектирования ИИМ: раз…` - 12 edges
10. `ОКР «ЯМГ-ИИМ», этап 1` - 11 edges

## Surprising Connections (you probably didn't know these)
- `2.1.4 Разработка и согласование с Заказчиком отдельно…` --references_stale_number--> `2.1.7 Формирование плана закупок и закупка материальн…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json → data/seed_ymg_stage1.json  _Bridges community 6 → community 4_
- `2.1.6 Формирование и выдача технических заданий соисп…` --references_stale_number--> `2.1.7 Формирование плана закупок и закупка материальн…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json → data/seed_ymg_stage1.json  _Bridges community 2 → community 4_
- `2.2.1 Выполнение соисполнителем (ФТИ им. А.Ф. Иоффе) …` --references_stale_number--> `2.1.5 Разработка и согласование с Заказчиком отдельно…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json → data/seed_ymg_stage1.json  _Bridges community 2 → community 6_
- `1.4 Размещение сведений о проведении ОКР (этапа ОКР…` --depends_on--> `3.2 Формирование и передача Заказчику сопроводитель…`  [INFERRED]
  data/seed_ymg_stage1.json → data/seed_ymg_stage1.json  _Bridges community 3 → community 1_
- `2.1.2 Выбор и обоснование принципиальной схемы кванто…` --depends_on--> `2.2.4 Выполнение технического проектирования ИИМ: раз…`  [INFERRED]
  data/seed_ymg_stage1.json → data/seed_ymg_stage1.json  _Bridges community 0 → community 4_

## Hyperedges (group relationships)
- **Срок 30.09.2026: 9 поз.** — poz_1_4, poz_1_5, poz_2_1_1, poz_2_1_1_5, poz_2_1_2, poz_2_1_2_6, poz_2_1_6, poz_2_1_8, poz_2_1_9 [EXTRACTED 1.00]
- **Срок 27.11.2026: 10 поз.** — poz_2_2_3, poz_2_2_3_6, poz_2_2_4, poz_2_2_4_4, poz_2_2_4_5, poz_2_2_5, poz_2_2_5_3, poz_2_2_6, poz_2_2_7, poz_2_2_9 [EXTRACTED 1.00]
- **Критическая цепочка ЛО (предложение)** — poz_2_1_7, poz_2_1_6, poz_2_2_2, poz_2_2_4_1, poz_2_2_5_1, poz_2_2_5_2, poz_2_2_5_3, poz_2_2_5_5, poz_2_1_9 [EXTRACTED 1.00]
- **«Нет отметки» при наступившем сроке** — poz_2_1_1_2, poz_2_1_1_3, poz_2_1_2_1, poz_2_1_2_2, poz_2_1_2_3, poz_2_1_2_4 [EXTRACTED 1.00]

## Communities (7 total, 0 thin omitted)

### Community 0 - "Патентные исследования, схема, модель"
Cohesion: 0.15
Nodes (27): Электроприбор, ТЗ п. 12.1, ТЗ п. 13.3.1, Договор п. 6.18, Договор п. 6.2, ТЗ п. 9.1, ТЗ п. 9.2, 2.1.1 Патентные исследования по направлению работ (+19 more)

### Community 1 - "Сдача этапа и финансовая отчётность"
Cohesion: 0.14
Nodes (25): ТЗ п. 13.1.1, ТЗ п. 13.1.2, Договор п. 2.14, Договор п. 3.7, Договор п. 5.2, Договор п. 5.3, Договор п. 5.4, Договор п. 5.5 (+17 more)

### Community 2 - "Соисполнители и отчётность ТП"
Cohesion: 0.18
Nodes (19): ФТИ им. Иоффе, ИХС им. Гребенщикова, ТЗ п. 13.1.3, Договор п. 2.6.1, Договор п. 2.6.2, ТЗ п. 3.2.11, ТЗ п. 3.3.3, ТЗ п. 3.6.12 (+11 more)

### Community 3 - "Запуск договора"
Cohesion: 0.13
Nodes (15): ТЗ п. 13.1.4, Договор п. 2.20, Договор п. 2.7.2, Договор п. 3.8а), Договор п. 3.8б), Договор п. 6.6, 1 Запуск, 1.1 Уведомление Заказчика о наличии у Исполнителя и… (+7 more)

### Community 4 - "КД и изготовление ЛО"
Cohesion: 0.32
Nodes (13): Основание «М» (не расшифровано), 2.1.2.2 Обоснование выбора лазерных излучателей VCSEL н…, 2.1.2.4 Обоснование схемы магнитной системы, 2.1.7 Формирование плана закупок и закупка материальн…, 2.2.4 Выполнение технического проектирования ИИМ: раз…, 2.2.4.1 Разработка КД на миниатюрную сферическую газову…, 2.2.4.2 Разработка КД на магнитную систему: четырехсегм…, 2.2.4.3 Разработка КД на оптический блок: лазерные излу… (+5 more)

### Community 5 - "Испытания и демонстрация ЛО"
Cohesion: 0.31
Nodes (10): ТЗ п. 13.2, ТЗ п. 13.3.2, ТЗ п. 13.3.3, Договор п. 2.8, 2.1.9 Согласование с Заказчиком программы и методики …, 2.2.5 Создание лабораторной базы для подтверждения пр…, 2.2.5.3 Исследования (испытания) лабораторного образца …, 2.2.5.4 Направление Заказчику приглашения на демонстрац… (+2 more)

### Community 6 - "ТЗ соисполнителей, участие Заказчика"
Cohesion: 0.31
Nodes (9): СП «Квант», ТЗ п. 10.1, ТЗ п. 5.1.2, 2 Реализация этапа 1 (13.08.2026 - 30.12.2026), 2.1 3 квартал 2026 года, 2.1.3 Разработка и согласование Заказчиком Перечня-ко…, 2.1.4 Разработка и согласование с Заказчиком отдельно…, 2.1.5 Разработка и согласование с Заказчиком отдельно… (+1 more)

## Ambiguous Edges - Review These
- `2.1.4 Разработка и согласование с Заказчиком отдельно…` → `2.1.5 Разработка и согласование с Заказчиком отдельно…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: references_stale_number
- `2.1.4 Разработка и согласование с Заказчиком отдельно…` → `2.1.7 Формирование плана закупок и закупка материальн…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: references_stale_number
- `2.1.6 Формирование и выдача технических заданий соисп…` → `2.1.7 Формирование плана закупок и закупка материальн…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: references_stale_number
- `2.2.1 Выполнение соисполнителем (ФТИ им. А.Ф. Иоффе) …` → `2.1.5 Разработка и согласование с Заказчиком отдельно…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: references_stale_number
- `2.2.2 Выполнение соисполнителем (Институт химии силик…` → `2.2.4.1 Разработка КД на миниатюрную сферическую газову…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: critical_chain_next
- `2.2.4.1 Разработка КД на миниатюрную сферическую газову…` → `2.2.5.1 Изготовление макетов газовых ячеек и проведение…`  [AMBIGUOUS]
  data/seed_ymg_stage1.json · relation: critical_chain_next

## Knowledge Gaps
- **23 isolated node(s):** `Веха 01.01.2027: Начало этапа 2`, `Договор п. 6.6`, `Договор п. 2.20`, `Договор п. 2.7.2`, `Договор п. 3.8б)` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 23 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `2.1.4 Разработка и согласование с Заказчиком отдельно…` and `2.1.5 Разработка и согласование с Заказчиком отдельно…`?**
  _Edge tagged AMBIGUOUS (relation: references_stale_number) - confidence is low._
- **What is the exact relationship between `2.1.4 Разработка и согласование с Заказчиком отдельно…` and `2.1.7 Формирование плана закупок и закупка материальн…`?**
  _Edge tagged AMBIGUOUS (relation: references_stale_number) - confidence is low._
- **What is the exact relationship between `2.1.6 Формирование и выдача технических заданий соисп…` and `2.1.7 Формирование плана закупок и закупка материальн…`?**
  _Edge tagged AMBIGUOUS (relation: references_stale_number) - confidence is low._
- **What is the exact relationship between `2.2.1 Выполнение соисполнителем (ФТИ им. А.Ф. Иоффе) …` and `2.1.5 Разработка и согласование с Заказчиком отдельно…`?**
  _Edge tagged AMBIGUOUS (relation: references_stale_number) - confidence is low._
- **What is the exact relationship between `2.2.2 Выполнение соисполнителем (Институт химии силик…` and `2.2.4.1 Разработка КД на миниатюрную сферическую газову…`?**
  _Edge tagged AMBIGUOUS (relation: critical_chain_next) - confidence is low._
- **What is the exact relationship between `2.2.4.1 Разработка КД на миниатюрную сферическую газову…` and `2.2.5.1 Изготовление макетов газовых ячеек и проведение…`?**
  _Edge tagged AMBIGUOUS (relation: critical_chain_next) - confidence is low._
- **Why does `2.2.8 Подготовка отчетной документации по этапу (в то…` connect `Соисполнители и отчётность ТП` to `Патентные исследования, схема, модель`, `Сдача этапа и финансовая отчётность`, `КД и изготовление ЛО`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._