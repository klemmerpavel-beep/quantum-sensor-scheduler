"""Сборка самодостаточных страниц «Орбиты» из src/ (Р-43, Р-45).

Выход: versions/v1-panel.html, versions/v2-registry.html, versions/v3-path.html, index.html (выбранная версия).
Запуск: python3 tools/build.py [--index v1|v2|v3]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
VARIANTS = {
    "v1": ("panel", "v1-panel.html", "В1 «Панель»"),
    "v2": ("registry", "v2-registry.html", "В2 «Реестр»"),
    "v3": ("path", "v3-path.html", "В3 «Путь к ЛО»"),
}


def page(variant_key):
    code, _, title = VARIANTS[variant_key]
    seed = json.loads((ROOT / "data/seed_ymg_stage1.json").read_text(encoding="utf-8"))
    tpl = (SRC / "template.html").read_text(encoding="utf-8")
    seed_js = json.dumps(seed, ensure_ascii=False).replace("</", "<\\/")
    repl = {
        "{{TITLE}}": "Орбита · ЯМГ-ИИМ · Этап 1",
        "{{VARIANT}}": code,
        "{{VARIANT_TITLE}}": title,
        "{{STYLE}}": (SRC / "style.css").read_text(encoding="utf-8"),
        "{{CONFIG}}": (SRC / "config.js").read_text(encoding="utf-8"),
        "{{ENGINE}}": (SRC / "engine.js").read_text(encoding="utf-8"),
        "{{APP}}": (SRC / "app.js").read_text(encoding="utf-8"),
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
    (ROOT / "index.html").write_text(page(index_key), encoding="utf-8")
    print("index.html =", VARIANTS[index_key][2])


if __name__ == "__main__":
    main()
