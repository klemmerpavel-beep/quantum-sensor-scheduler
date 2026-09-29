#!/usr/bin/env bash
# Публикация собранных страниц в ветку gh-pages (Р-57). Запуск: bash tools/publish.sh
# Публикуются только index.html, versions/, dist/ и три снимка для страницы версий; исходники в gh-pages не входят.
set -euo pipefail
KIT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(git -C "$KIT" rev-parse --show-toplevel)"
REV="$(git -C "$REPO" rev-parse --short HEAD)"
SITE="$(mktemp -d)/site"
git -C "$REPO" fetch -q origin gh-pages
git -C "$REPO" worktree add -q "$SITE" origin/gh-pages -B gh-pages
trap 'git -C "$REPO" worktree remove --force "$SITE"' EXIT
mkdir -p "$SITE/versions" "$SITE/dist" "$SITE/screenshots"
cp "$KIT/index.html" "$SITE/"
cp "$KIT"/versions/*.html "$SITE/versions/"
cp "$KIT"/dist/*.html "$SITE/dist/"
for f in v1-panel_summary_1440_light v2-registry_gantt_1440_light v3-path_summary_1440_light; do cp "$KIT/screenshots/$f.png" "$SITE/screenshots/"; done
touch "$SITE/.nojekyll"
git -C "$SITE" add -A
if git -C "$SITE" diff --cached --quiet; then echo "Изменений для публикации нет."; exit 0; fi
git -C "$SITE" commit -q -m "Публикация из ${REV}${PUBLISH_NOTE:+: $PUBLISH_NOTE}" ${PUBLISH_TRAILER:+-m "$PUBLISH_TRAILER"}
git -C "$SITE" push -q origin gh-pages
echo "Опубликовано: https://klemmerpavel-beep.github.io/quantum-sensor-scheduler/ (сборка ${REV})"
