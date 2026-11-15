#!/usr/bin/env bash
# Betriebstest auf einem Testrechner (simuliert: eigene Testinstanz, Testschlüssel, Testdaten): jede Aktion des
# Betriebs gegen echte Container, mit Zeitmessung und Datenprüfung danach.
#   1 einrichten (betrieb/spur einrichten: Schlüssel erzeugen, bauen, starten)
#   2 neu starten (betrieb/spur neustart)                       3 Sicherung anlegen und zurückspielen (CLI)
#   4 neue Version (betrieb/spur aktualisieren)                 5 letzte Version zurück über die Betriebsseite und den
#   6 defekte neue Version: automatisch zurück                    Betriebsdienst (betrieb/spur wache)
#   7 Hänger: der Betriebsdienst startet die Anwendung neu
# Aufruf aus der Wurzel eines Checkouts: tools/betriebstest.sh <ausgabeordner>
# Legt eine Kopie unter $BETRIEBSTEST_ORDNER an (Standard: $TMPDIR bzw. /tmp/spurensuche-betriebstest) und räumt am Ende auf.
set -euo pipefail

QUELLE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "${1:-$QUELLE/nachweis/tmp}"
AUSGABE="$(cd "${1:-$QUELLE/nachweis/tmp}" && pwd)"
ZIEL="${BETRIEBSTEST_ORDNER:-${TMPDIR:-/tmp}/spurensuche-betriebstest}"
PORT="${BETRIEBSTEST_PORT:-18090}"
BILD=spurbt
PROJEKT="$(basename "$ZIEL")"
UIDGID="$(id -u):$(id -g)"
LOGDATEI="$AUSGABE/betriebstest.log"
: > "$LOGDATEI"
[ "$(basename "$ZIEL")" = "spurensuche-betriebstest" ] || { echo "Testordner muss spurensuche-betriebstest heißen (Schutz vor rm -rf)"; exit 2; }

ms() { date +%s%3N; }
sag() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$LOGDATEI"; }
ERGEBNIS=()
notiere() { ERGEBNIS+=("\"$1\": $2"); }
zeichen() { printf '"%s"' "$(printf '%s' "$1" | tr -d '\n\r' | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
wert() { sed -n "s/^$1=//p" "$ZIEL/.env" | tail -n 1; }
URL="http://127.0.0.1:$PORT"
status() { curl -fsS -m 5 "$URL/api/v1/status" 2>/dev/null || true; }
feld() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }
spur() { (cd "$ZIEL" && SPUR_JA=1 betrieb/spur "$@") 2>&1 | tee -a "$LOGDATEI"; return "${PIPESTATUS[0]}"; }
ablauf() {
  docker run --rm --network "${PROJEKT}_default" --user "$UIDGID" -v "$ZIEL:/app:ro" -v "$AUSGABE:/aus" -w /app \
    -e APP_URL=http://spurensuche:8080 -e ZUSTAND=/aus/.betriebstest-zustand.json -e NODE_NO_WARNINGS=1 \
    -e VERWALTUNG_SCHLUESSEL="$(wert SPUR_VERWALTUNG_SCHLUESSEL)" -e BETRIEB_SCHLUESSEL="$(wert SPUR_BETRIEB_SCHLUESSEL)" \
    node:24-alpine node test/betrieb-ablauf.js "$@"
}
FEHLER=0
pruefe() { if eval "$2"; then sag "  ok: $1"; else sag "  FEHLER: $1"; FEHLER=$((FEHLER + 1)); fi; }

WACHE=""
aufraeumen() {
  [ -n "$WACHE" ] && kill "$WACHE" 2>/dev/null || true
  if [ -d "$ZIEL" ]; then
    cp "$ZIEL/betrieb/betrieb.log" "$AUSGABE/betriebstest-spur.log" 2>/dev/null || true
    (cd "$ZIEL" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
    rm -rf "$ZIEL"
  fi
  docker image ls "$BILD" --format '{{.Repository}}:{{.Tag}}' | xargs -r docker image rm -f >/dev/null 2>&1 || true
  rm -f "$AUSGABE/.betriebstest-zustand.json"
}
trap aufraeumen EXIT

if curl -s -m 2 "$URL" >/dev/null 2>&1; then echo "Port $PORT ist belegt"; exit 2; fi
rm -rf "$ZIEL"
mkdir -p "$ZIEL"
(cd "$QUELLE" && tar --exclude=./daten --exclude=./nachweis --exclude=./node_modules --exclude=./.git --exclude=./.env -cf - .) | (cd "$ZIEL" && tar -xf -)
G=(git -C "$ZIEL" -c user.name=Betriebstest -c user.email=betriebstest@example.invalid -c core.excludesFile=/dev/null)
"${G[@]}" init -q
"${G[@]}" add -A
"${G[@]}" commit -q -m "Stand für den Betriebstest"
printf 'SPUR_BILD=%s\nSPUR_HOST_PORT=%s\nSPUR_OEFFENTLICHE_URL=http://localhost:%s\nTZ=Europe/Berlin\n' "$BILD" "$PORT" "$PORT" > "$ZIEL/.env"
notiere zeitpunkt "$(zeichen "$(date -Iseconds)")"
notiere stand "$(zeichen "${STAND:-$(git -C "$QUELLE" rev-parse --short HEAD 2>/dev/null || echo unbekannt)}")"
notiere docker "$(zeichen "$(docker version --format '{{.Server.Version}}' 2>/dev/null)")"

sag "1 Einrichten"
t0=$(ms); spur einrichten >/dev/null; t1=$(ms)
V0="$(status | feld installiert)"
notiere einrichtenMs $((t1 - t0)); notiere version "$(zeichen "$V0")"
pruefe "Anwendung läuft nach dem Einrichten (Version $V0)" '[ -n "$V0" ]'
pruefe "Schlüssel in .env erzeugt" '[ -n "$(wert SPUR_BETRIEB_SCHLUESSEL)" ] && [ -n "$(wert SPUR_SICHERUNG_SCHLUESSEL)" ] && [ -n "$(wert SPUR_BETRIEB_AGENT_TOKEN)" ]'
ablauf anlegen "Klasse vor allem" >/dev/null

sag "2 Neustart"
g0="$(status | feld gestartet)"
t0=$(ms); spur neustart >/dev/null; t1=$(ms)
notiere neustartMs $((t1 - t0))
pruefe "neue Startzeit nach dem Neustart" '[ "$(status | feld gestartet)" != "$g0" ]'
pruefe "Daten nach dem Neustart da" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'

sag "3 Sicherung und Zurückspielen"
t0=$(ms); spur sicherung >/dev/null; t1=$(ms)
notiere sicherungMs $((t1 - t0))
DATEI="$(cd "$ZIEL" && docker compose run --rm --no-deps -T --entrypoint node spurensuche tools/rueckspielen.js --liste | awk -F'\t' '$2 == "hand" {print $1; exit}')"
pruefe "Sicherung von Hand angelegt ($DATEI)" '[ -n "$DATEI" ]'
sleep 1
ablauf anlegen "Klasse nach der Sicherung" >/dev/null
t0=$(ms); spur zurueckspielen "$DATEI" >/dev/null; t1=$(ms)
notiere zurueckspielenMs $((t1 - t0))
pruefe "Stand der Sicherung zurück (nur die erste Klasse)" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'
pruefe "jetziger Stand vorher gesichert" '(cd "$ZIEL" && docker compose run --rm --no-deps -T --entrypoint node spurensuche tools/rueckspielen.js --liste) | grep -q vor-zurueckspielen'

sag "4 Neue Version"
"${G[@]}" commit -q --allow-empty -m "Prüfversion"
"${G[@]}" tag "v$V0-probe"
t0=$(ms); spur aktualisieren "v$V0-probe" >/dev/null; t1=$(ms)
notiere aktualisierenMs $((t1 - t0))
pruefe "Version $V0-probe läuft" '[ "$(status | feld installiert)" = "$V0-probe" ]'
pruefe "Daten nach dem Versionswechsel da" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'

sag "5 Letzte Version zurück über die Betriebsseite und den Betriebsdienst"
(cd "$ZIEL" && exec betrieb/spur wache) >> "$AUSGABE/betriebstest-wache.log" 2>&1 &
WACHE=$!
for _ in $(seq 1 30); do ablauf zustand | grep -q '"versionZurueck":true' && break; sleep 2; done
pruefe "Knopf frei, sobald der Betriebsdienst sich meldet" 'ablauf zustand | grep -q "\"versionZurueck\":true"'
ZURUECK="$(ablauf version-zurueck)"
sag "  $ZURUECK"
notiere versionZurueck "$ZURUECK"
pruefe "Auftrag erledigt" 'printf "%s" "$ZURUECK" | grep -q "\"status\":\"fertig\""'
pruefe "Version $V0 läuft wieder" '[ "$(status | feld installiert)" = "$V0" ]'
pruefe "Daten nach dem Zurückspielen der Version da" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'

sag "6 Defekte neue Version: automatisch zurück"
printf '#!/usr/bin/env node\nconsole.error("Absichtlich defekte Prüfversion");\nprocess.exit(3);\n' > "$ZIEL/server/start.js"
"${G[@]}" commit -q -am "defekte Prüfversion"
"${G[@]}" tag "v$V0-defekt"
t0=$(ms); if spur aktualisieren "v$V0-defekt" >/dev/null; then AUTO=nein; else AUTO=ja; fi; t1=$(ms)
notiere defektBisZurueckMs $((t1 - t0)); notiere defektAutomatischZurueck "$(zeichen "$AUTO")"
pruefe "Aktualisieren meldet den Fehler" '[ "$AUTO" = ja ]'
pruefe "Version $V0 läuft weiter" '[ "$(status | feld installiert)" = "$V0" ]'
pruefe "Daten da" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'

sag "7 Hänger: Betriebsdienst startet neu"
g0="$(status | feld gestartet)"
t0=$(ms)
# Prozess von außen anhalten (ein Signal aus dem Container an PID 1 ignoriert der Kernel); Docker meldet den Container
# weiter als „läuft“, die Gesundheitsprüfung schlägt fehl, der Betriebsdienst muss neu starten
docker kill --signal=SIGSTOP "$(cd "$ZIEL" && docker compose ps -q spurensuche)" >/dev/null
while [ $(( $(ms) - t0 )) -lt 300000 ]; do
  s="$(status)"
  if printf '%s' "$s" | grep -q '"ok":true' && [ "$(printf '%s' "$s" | feld gestartet)" != "$g0" ]; then break; fi
  sleep 2
done
t1=$(ms)
notiere haengerBisWiederDaMs $((t1 - t0))
pruefe "nach dem Hänger wieder erreichbar (neu gestartet)" '[ "$(status | feld gestartet)" != "$g0" ] && status | grep -q "\"ok\":true"'
pruefe "Daten da" '[ "$(ablauf zaehlen)" = "{\"lerngruppen\":[\"Klasse vor allem\"]}" ]'

notiere fehler "$FEHLER"
notiere hinweis "$(zeichen "Simuliert: eigene Testinstanz mit Testschlüsseln und Testdaten auf einem Testrechner. Zeiten in Millisekunden vom Befehl bis zur Antwort der Anwendung.")"
{ printf '{\n'; for i in "${!ERGEBNIS[@]}"; do printf '  %s%s\n' "${ERGEBNIS[$i]}" "$([ "$i" -lt $((${#ERGEBNIS[@]} - 1)) ] && echo ,)"; done; printf '}\n'; } > "$AUSGABE/betriebstest.json"
sag "Ergebnis: betriebstest.json, $FEHLER Fehler"
exit $((FEHLER > 0))
