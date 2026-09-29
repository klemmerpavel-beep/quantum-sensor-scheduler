"""Сборка самодостаточных страниц «Орбиты» из src/ (Р-43, Р-45).

Выход: versions/v1-panel.html, versions/v2-registry.html, versions/v3-path.html, versions/index.html (страница версий
из src/versions.html), index.html (выбранная версия),
dist/crm-ymg-iim-stage1-offline.html — выбранная версия без обращений в интернет для внутреннего контура (Р-42, Р-66).
Запуск: python3 tools/build.py [--index v1|v2|v3]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
# Модули интерфейса (src/ui/) выполняются в одной области видимости: порядок важен (ARCHITECTURE.md §3).
UI_PARTS = ["core", "chrome", "summary", "gantt", "focus", "board", "milestones", "panel", "dialogs", "main"]


def app_js():
    """Собирает интерфейс из модулей src/ui/ в одну функцию-обёртку."""
    parts = [(SRC / "ui" / f"{name}.js").read_text(encoding="utf-8") for name in UI_PARTS]
    head = "/* CRM «Квантовый сенсор ИИМ ЯМГ (Электроприбор)» — интерфейс. Модули: src/ui/" + ", ".join(UI_PARTS) + ". */\n"
    return head + "(function () {\n  \"use strict\";\n" + "\n".join(parts) + "})();\n"
VARIANTS = {
    "v1": ("panel", "v1-panel.html", "В1 «Панель»"),
    "v2": ("registry", "v2-registry.html", "В2 «Реестр»"),
    "v3": ("path", "v3-path.html", "В3 «Путь к демонстрации»"),
}


def offline(html):
    """Убирает подключение Google Fonts: страница работает на системных гарнитурах без сети."""
    import re
    html = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n?', "", html)
    assert "https://" not in html.split("<style>")[0], "во внешнем заголовке остались сетевые ссылки"
    return html


def page(variant_key):
    code, _, title = VARIANTS[variant_key]
    seed = json.loads((ROOT / "data/seed_ymg_stage1.json").read_text(encoding="utf-8"))
    tpl = (SRC / "template.html").read_text(encoding="utf-8")
    seed_js = json.dumps(seed, ensure_ascii=False).replace("</", "<\\/")
    repl = {
        "{{TITLE}}": "CRM · Квантовый сенсор ИИМ ЯМГ (Электроприбор)",
        "{{VARIANT}}": code,
        "{{VARIANT_TITLE}}": title,
        "{{STYLE}}": (SRC / "style.css").read_text(encoding="utf-8"),
        "{{CONFIG}}": (SRC / "config.js").read_text(encoding="utf-8"),
        "{{ENGINE}}": (SRC / "engine.js").read_text(encoding="utf-8"),
        "{{APP}}": app_js(),
        "{{SEED}}": seed_js,
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, v)
    return tpl


def main():
    index_key = "v1"
    if "--index" in sys.argv:
        index_key = sys.argv[sys.argv.index("--index") + 1]
    out = ROOT / "versions"
    out.mkdir(exist_ok=True)
    for key, (_, fname, title) in VARIANTS.items():
        (out / fname).write_text(page(key), encoding="utf-8")
        print("written", out / fname)
    (out / "index.html").write_text((SRC / "versions.html").read_text(encoding="utf-8"), encoding="utf-8")
    print("written", out / "index.html", "(страница версий)")
    (ROOT / "index.html").write_text(page(index_key), encoding="utf-8")
    print("index.html =", VARIANTS[index_key][2])
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    (dist / "crm-ymg-iim-stage1-offline.html").write_text(offline(page(index_key)), encoding="utf-8")
    print("written", dist / "crm-ymg-iim-stage1-offline.html")


if __name__ == "__main__":
    main()
