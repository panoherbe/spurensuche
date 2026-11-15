#!/usr/bin/env bash
# Messlauf für den Nachweis: alle Prüfungen nacheinander, Ergebnisse nach nachweis/<datum>/, danach PROTOKOLL.md.
# Läuft auf dem Prüfrechner im Repository (Docker nötig). Jede Zahl im Protokoll kommt aus einer Datei hier.
# Aufruf: tools/messlauf.sh [ordner]   Umgebung: LAST_MIN (45), STRESS_MIN (15), BUENDEL (git-Quelle für den Nachbau)
set -uo pipefail
DATUM="$(date +%Y-%m-%d)"
ZIEL="${1:-nachweis/${DATUM}}"
mkdir -p "$ZIEL"
export UID_GID="$(id -u):$(id -g)"
LOG="$ZIEL/messlauf.log"
: > "$LOG"
schritt() { echo "== $(date -u +%H:%M:%S) $1" | tee -a "$LOG"; }
ergebnis() { echo "   -> Rückgabe $1" | tee -a "$LOG"; echo "$2=$1" >> "$ZIEL/rueckgaben.txt"; }
: > "$ZIEL/rueckgaben.txt"
echo "${STAND:-unbekannt}" > "$ZIEL/stand.txt"
uptime > "$ZIEL/rechner-vorher.txt"; nproc >> "$ZIEL/rechner-vorher.txt"; free -g >> "$ZIEL/rechner-vorher.txt"
docker ps --format '{{.Names}} {{.Image}}' >> "$ZIEL/rechner-vorher.txt"

schritt "Tests"
docker run --rm --user "$UID_GID" -e HOME=/tmp -v "$PWD":/app -w /app node:24-alpine sh -c "node --version > $ZIEL/node-version.txt; node --test --test-reporter=tap test/*.test.js" > "$ZIEL/tests.tap" 2>&1
ergebnis $? tests

schritt "Inhalte prüfen"
docker run --rm --user "$UID_GID" -v "$PWD":/app -w /app node:24-alpine node tools/pruefe-inhalte.js > "$ZIEL/inhalte.txt" 2>&1
ergebnis $? inhalte

schritt "QR-Gegenprobe mit zbarimg"
docker run --rm --user "$UID_GID" -v "$PWD":/app -w /app node:24-alpine node tools/qr-pngs.js "$ZIEL/qr" > /dev/null
docker run --rm -v "$PWD/$ZIEL/qr":/qr:ro alpine:3.22 sh -c 'apk add -q --no-cache zbar imagemagick >/dev/null 2>&1; echo "zbar $(apk info -v 2>/dev/null | grep ^zbar- )"; for f in /qr/qr-*.png; do printf "%s\t" "$(basename "$f")"; zbarimg -q --raw "$f" 2>/dev/null || echo FEHLER; done' > "$ZIEL/qr/zbar.txt"
ergebnis $? qr

schritt "Browser: Instanz mit Testinhalten (rauchtest)"
AUSGABE="$ZIEL/browser" timeout 900 docker compose -p spur-test -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from pruefer > "$ZIEL/browser-rauchtest.log" 2>&1
ergebnis $? rauchtest
docker compose -p spur-test -f compose.test.yaml down -v > /dev/null 2>&1

schritt "Browser: Vorführung mit echten Inhalten"
AUSGABE="$ZIEL/browser" PRUEFSKRIPT=test/e2e/vorfuehrung.js timeout 900 docker compose -p spur-test -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from pruefer > "$ZIEL/browser-vorfuehrung.log" 2>&1
ergebnis $? vorfuehrung
docker compose -p spur-test -f compose.test.yaml down -v > /dev/null 2>&1

if [ -f test/e2e/spiele.js ]; then
  schritt "Browser: alle Spiele der echten Inhalte"
  AUSGABE="$ZIEL/browser" PRUEFSKRIPT=test/e2e/spiele.js SPUR_TEST_INHALTE=/srv/spurensuche timeout 1200 docker compose -p spur-test -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from pruefer > "$ZIEL/browser-spiele.log" 2>&1
  ergebnis $? spiele
  docker compose -p spur-test -f compose.test.yaml down -v > /dev/null 2>&1
fi

if [ -n "${BUENDEL:-}" ]; then
  schritt "Nachbau-Test"
  timeout 900 tools/nachbau-test.sh "$BUENDEL" "$ZIEL/nachbau.json" > "$ZIEL/nachbau.log" 2>&1
  ergebnis $? nachbau
fi

lasttest() {
  local n="$1" min="$2" denk="$3"
  schritt "Lasttest ${n} Sitzungen, ${min} Minuten (simuliert)"
  ( while sleep 10; do docker stats --no-stream --format '{{.Name}};{{.CPUPerc}};{{.MemUsage}}' spur-last-spur-1 2>/dev/null | sed "s/^/$(date -u +%H:%M:%S);/"; done ) > "$ZIEL/last-${n}-docker-stats.csv" &
  local beobachter=$!
  SITZUNGEN="$n" DAUER_MIN="$min" DENKZEIT_S="$denk" AUSGABE="$ZIEL" timeout $(( min * 60 + 1200 )) docker compose -p spur-last -f compose.last.yaml up --build --abort-on-container-exit --exit-code-from last > "$ZIEL/last-${n}.log" 2>&1
  local rc=$?
  kill "$beobachter" 2>/dev/null
  uptime > "$ZIEL/last-${n}-rechner.txt"
  ergebnis $rc "last${n}"
}

lasttest 400 "${LAST_MIN:-45}" "${DENKZEIT_S:-30-60}"
schritt "Rückspieltest und Archiv-Probelauf auf der Datenbank des Lasttests"
docker compose -p spur-last -f compose.last.yaml --profile nachtest run --rm nachtest node tools/rueckspieltest.js /daten/spurensuche.db "$ZIEL/rueckspiel.json" > "$ZIEL/rueckspiel.log" 2>&1
ergebnis $? rueckspiel
docker compose -p spur-last -f compose.last.yaml --profile nachtest run --rm nachtest node tools/archiv-probelauf.js /daten/spurensuche.db "$ZIEL/archiv.json" > "$ZIEL/archiv.log" 2>&1
ergebnis $? archiv
docker compose -p spur-last -f compose.last.yaml down -v > /dev/null 2>&1

lasttest 600 "${STRESS_MIN:-15}" "${DENKZEIT_S:-30-60}"
docker compose -p spur-last -f compose.last.yaml down -v > /dev/null 2>&1

uptime > "$ZIEL/rechner-nachher.txt"
schritt "Protokoll"
docker run --rm --user "$UID_GID" -v "$PWD":/app -w /app node:24-alpine node tools/protokoll.js "$ZIEL" >> "$LOG" 2>&1
ergebnis $? protokoll
schritt "fertig"
