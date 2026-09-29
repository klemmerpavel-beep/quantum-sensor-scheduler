"""Сборка отчёта: дашборд со встроенными шрифтами и HTML презентации для печати в PDF.

Запуск из каталога src/:  python3 build.py && node render_pdf.js
Шрифты (Geologica, Golos Text; кириллица и латиница) скачиваются с Google Fonts
и встраиваются как data URI, чтобы файлы открывались без интернета.
"""
import base64, re, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
CSS_URL = ("https://fonts.googleapis.com/css2?family=Geologica:wght@500;600;700"
           "&family=Golos+Text:wght@400;500;600;700&display=swap")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()


def embedded_fonts():
    css = fetch(CSS_URL).decode()
    faces, cache = [], {}
    for subset, block in re.findall(r"/\* ([\w-]+) \*/\s*(@font-face\s*\{[^}]*\})", css):
        if subset not in ("cyrillic", "latin"):
            continue
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        if url not in cache:
            cache[url] = "data:font/woff2;base64," + base64.b64encode(fetch(url)).decode()
        faces.append(block.replace(url, cache[url]))
    return "\n".join(faces)


def main():
    fonts = embedded_fonts()
    src = (HERE / "dashboard.artifact.html").read_text(encoding="utf-8")
    head, body = src.split("<!--HEAD-END-->", 1)
    head = re.sub(r'<link rel="preconnect"[^>]*>\n', "", head)
    head = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n',
                  lambda _: "<style>\n" + fonts + "\n</style>\n", head)
    (OUT / "dashboard.html").write_text(
        '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + head.strip() + "\n</head>\n<body>\n" + body.strip() + "\n</body>\n</html>\n", encoding="utf-8")
    deck = (HERE / "deck.src.html").read_text(encoding="utf-8")
    deck = deck.replace("/*FONTS*/", fonts).replace("/*CHARTS*/", (HERE / "charts.js").read_text(encoding="utf-8"))
    (HERE / "deck.html").write_text(deck, encoding="utf-8")
    print("dashboard.html, src/deck.html — готово")


if __name__ == "__main__":
    main()
