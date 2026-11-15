#!/bin/sh
# Messlauf der Spiele in Containern, ohne Netz: erst node --test (Logik), dann Playwright mit axe-core
# (Tastatur-Durchlauf, Barrierefreiheit, Bildschirmfotos). Ergebnis: $AUS/messwerte.json, $AUS/tests.tap, $AUS/groessen.json, $AUS/bilder/.
#
#   REPO=/pfad/zum/repo AUS=/pfad/ausgabe AXE=/pfad/axe.min.js sh spiele/_pruefung/laufen.sh [--nur bastei/1] [--umfang schnell]
#
# axe.min.js kommt aus dem npm-Paket axe-core (npm pack axe-core); die Version steht danach in messwerte.json.
set -eu
: "${REPO:?REPO = Pfad zum Repo-Stand}"
: "${AUS:?AUS = Ausgabeordner}"
: "${AXE:?AXE = Pfad zu axe.min.js}"
ABBILD=spurensuche-pruefung:1.56.0
mkdir -p "$AUS"
docker image inspect "$ABBILD" >/dev/null 2>&1 || docker build -q -t "$ABBILD" "$REPO/spiele/_pruefung"
IDS="$(id -u):$(id -g)"
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$REPO":/repo:ro -v "$AUS":/aus node:24-alpine \
  sh -c 'cd /repo/spiele && node --version > /aus/node.txt && node --test --test-reporter=tap "_test/*.test.js" > /aus/tests.tap 2>&1; echo "exit=$?" >> /aus/tests.tap' || true
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$REPO":/repo:ro "$ABBILD" python3 /repo/spiele/_pruefung/groessen.py /repo > "$AUS/groessen.json"
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$REPO":/repo:ro -v "$AUS":/aus -v "$(dirname "$AXE")":/werkzeug:ro "$ABBILD" \
  sh -c "cd /repo && (python3 -m http.server 8737 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1 && python3 /repo/spiele/_pruefung/pruefung.py --basis http://127.0.0.1:8737 --repo /repo --aus /aus --axe /werkzeug/$(basename "$AXE") $*"
