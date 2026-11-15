#!/usr/bin/env bash
# Nachbau-Test: frischer Klon → laufende Instanz, nur mit der Anleitung aus docs/INSTALLATION.md. Misst die Zeit vom
# Klonen bis zur ersten erfolgreichen Statusabfrage (Bau ohne Zwischenspeicher, Basis-Image neu geprüft) und prüft,
# dass die erste verschlüsselte Sicherung entsteht. Räumt danach alles ab.
# Aufruf: tools/nachbau-test.sh <git-quelle: URL oder Bündel> <ergebnis.json> [port]
set -euo pipefail
QUELLE="$1"
AUSGABE="$(realpath -m "$2")"
PORT="${3:-18091}"
ORDNER="$(mktemp -d "${TMPDIR:-/tmp}/spur-nachbau-XXXXXX")"
PROJEKT="spur-nachbau-$$"
zufall() { head -c "$1" /dev/urandom | base64 | tr -d '\n'; }
aufraeumen() { (cd "$ORDNER/spurensuche" 2>/dev/null && docker compose -p "$PROJEKT" down -v --rmi all >/dev/null 2>&1) || true; rm -rf "$ORDNER"; }
trap aufraeumen EXIT

beginn=$(date +%s.%N)
git clone -q "$QUELLE" "$ORDNER/spurensuche"
cd "$ORDNER/spurensuche"
stand="$(git rev-parse --short HEAD)"
t_klon=$(date +%s.%N)
cp .env.beispiel .env
sed -i \
  -e "s|^SPUR_OEFFENTLICHE_URL=.*|SPUR_OEFFENTLICHE_URL=http://localhost:${PORT}|" \
  -e "s|^SPUR_HOST_PORT=.*|SPUR_HOST_PORT=${PORT}|" \
  -e "s|^SPUR_VERWALTUNG_SCHLUESSEL=.*|SPUR_VERWALTUNG_SCHLUESSEL=$(zufall 18)|" \
  -e "s|^SPUR_AUSSTELLUNG_TOKEN=.*|SPUR_AUSSTELLUNG_TOKEN=$(zufall 24)|" \
  -e "s|^SPUR_MESSWERTE_TOKEN=.*|SPUR_MESSWERTE_TOKEN=$(zufall 24)|" \
  -e "s|^SPUR_SICHERUNG_SCHLUESSEL=.*|SPUR_SICHERUNG_SCHLUESSEL=$(zufall 32)|" .env
docker compose -p "$PROJEKT" build --no-cache --pull --quiet
t_bau=$(date +%s.%N)
docker compose -p "$PROJEKT" up -d --quiet-pull >/dev/null 2>&1
until curl -sf "http://127.0.0.1:${PORT}/api/v1/status" -o "$ORDNER/status.json"; do
  sleep 0.5
  if (( $(date +%s) - ${beginn%.*} > 900 )); then echo "Zeitüberschreitung" >&2; exit 1; fi
done
t_laeuft=$(date +%s.%N)
sicherung="nein"
for _ in $(seq 1 30); do
  if docker compose -p "$PROJEKT" exec -T spurensuche sh -c 'ls /daten/sicherungen/*.db.enc' >/dev/null 2>&1; then sicherung="ja"; break; fi
  sleep 1
done
sek() { awk "BEGIN { printf \"%.1f\", $2 - $1 }"; }
cat > "$AUSGABE" <<JSON
{
  "zeitpunkt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stand": "${stand}",
  "anleitung": "docs/INSTALLATION.md (git clone, .env aus .env.beispiel, docker compose build/up)",
  "bau": "ohne Zwischenspeicher (--no-cache), Basis-Image neu geprüft (--pull)",
  "sekundenGesamt": $(sek "$beginn" "$t_laeuft"),
  "sekundenKlonen": $(sek "$beginn" "$t_klon"),
  "sekundenBauen": $(sek "$t_klon" "$t_bau"),
  "sekundenStarten": $(sek "$t_bau" "$t_laeuft"),
  "status": $(cat "$ORDNER/status.json"),
  "ersteSicherung": "${sicherung}"
}
JSON
echo "Nachbau-Test: $(sek "$beginn" "$t_laeuft") s vom Klonen bis zur laufenden Instanz (Stand ${stand}), erste Sicherung: ${sicherung}"
