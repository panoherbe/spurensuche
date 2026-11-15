# Betriebshandbuch

Kurz: Ein Container für die Anwendung, einer für die tägliche verschlüsselte Sicherung. Alles Wichtige geht mit
wenigen Befehlen: starten, Stand prüfen, sichern, zurückspielen, aktualisieren, zurück auf die Vorversion.
Personenbezogene Daten gibt es fast keine (docs/DATENSCHUTZ.md); die Protokolle enthalten keine.

## Starten, anhalten, Stand

```bash
docker compose up -d                 # starten (baut beim ersten Mal)
docker compose ps                    # beide Dienste „running“, Anwendung „healthy“
curl -s http://127.0.0.1:8080/api/v1/status
docker compose logs --tail 50 spurensuche
docker compose down                  # anhalten (Daten bleiben im Volume „daten“)
```

`/api/v1/status` meldet `ok`, Version, Schema, Version der Inhalte und die Zahl der Inhaltsfehler. Die
Verwaltungsseite `/verwaltung.html` zeigt dazu Größe des Offline-Pakets, Anzahl der Gruppen, letzte Sicherung und
das Protokoll der Verwaltungsaktionen.

## Überwachung

- **Erreichbarkeit:** `GET /api/v1/status` von außen prüfen (z. B. jede Minute). Der Container hat zusätzlich einen
  eigenen Gesundheitscheck (alle 15 Sekunden); Docker startet ihn bei Absturz neu (`restart: unless-stopped`).
- **Messwerte:** `GET /api/v1/betrieb/messwerte` mit `Authorization: Bearer <SPUR_MESSWERTE_TOKEN>` liefert das
  Prometheus-Textformat: Anfragen je Routenklasse und Status, Antwortzeiten als Histogramm, angenommene und
  doppelt gesendete Übertragungen, Laufzeit, aktive Gruppen der letzten 15 Minuten. Keine personenbezogenen Daten.
- **Verfügbarkeit** je Monat: aus der externen Erreichbarkeitsprüfung (Anteil erfolgreicher Prüfungen).

## Sicherung

Der Dienst `sicherung` sichert beim Start und danach täglich um 02:00 Uhr (`TZ`) die Datenbank: konsistente Kopie im
laufenden Betrieb (`VACUUM INTO`), verschlüsselt mit AES-256-GCM, nach `/daten/sicherungen/`
(`spurensuche-JJJJMMTT-hhmmss.db.enc` mit `.sha256`). Die neuesten 14 bleiben (`SPUR_SICHERUNG_ANZAHL`).

- **Schlüssel getrennt aufbewahren** (Passwortverwaltung der Betreiberin). Ohne Schlüssel ist eine Sicherung
  wertlos; ohne Schlüssel sichert der Dienst nicht.
- **Kopie außer Haus:** Den Ordner `sicherungen` täglich auf ein zweites System kopieren (z. B. `rsync` vom
  Sicherungsserver). Er enthält nur verschlüsselte Dateien.
- Höchstens 24 Stunden Datenverlust: Die Sicherung läuft täglich; die Gruppendaten sind kurzlebig (12 Wochen).

## Rückspielen

```bash
docker compose stop spurensuche sicherung
docker compose run --rm --entrypoint node spurensuche tools/rueckspielen.js \
  /daten/sicherungen/spurensuche-20261124-020000.db.enc --ziel /daten/spurensuche.db --ueberschreiben
docker compose up -d
```

Das Werkzeug prüft den GCM-Prüfwert (falscher Schlüssel oder veränderte Datei brechen ab) und danach
`PRAGMA integrity_check`. Der Rückspieltest (`nachweis/`) vergleicht dazu jede Tabelle des Originals mit der
zurückgespielten Fassung über SHA-256.

## Aktualisieren und zurück

```bash
git fetch --tags
git checkout v0.2.0                  # gewünschte Version
docker compose up -d --build
```

Zurück auf die Vorversion: dieselben Befehle mit der alten Version. Das Datenbankschema wird nur erweitert; eine
ältere Version läuft auf einer neueren Datenbank nicht immer. Deshalb vor jedem Update eine Sicherung auslösen:
`docker compose run --rm sicherung node tools/sicherung.js`.

## Inhalte tauschen

1. Neue Inhalte in `inhalte/`, `spiele/`, `assets/spiele/` (oder im Ordner aus `SPUR_INHALTE`) ablegen.
2. `docker compose run --rm --entrypoint node spurensuche tools/pruefe-inhalte.js` muss „keine Fehler“ melden.
3. In der Verwaltung „Inhalte neu laden und prüfen“ wählen. Geräte laden die neue Fassung beim nächsten Öffnen mit
   Netz vollständig nach; laufende Quests behalten ihre Orte und Aufgaben.

## Fristen und Löschen

Die Anwendung löscht stündlich, was abgelaufen ist: Gruppendaten zwölf Wochen nach Ende einer Quest, spätestens zum
Ende des Schuljahres (31. Juli), Lerngruppen zum Ende des Schuljahres, abgelaufene Sitzungen, Eingangsschlüssel nach
zwei Tagen, das Verwaltungsprotokoll nach einem Jahr. Nicht freigegebene Bildbeiträge gelöschter Gruppen werden mit
gelöscht; freigegebene bleiben ohne Bezug zur Gruppe für die Ausstellung.

## Übergabe und Archiv

In der Verwaltung: „Archiv herunterladen“ (BagIt nach RFC 8493: Inhalte, Konfiguration ohne Geheimnisse,
freigegebene Bildbeiträge, jede Datei mit SHA-256) oder „Vollständiger Export“ (zusätzlich Gruppendaten als JSON und
CSV). Übernahme in eine leere Instanz: `server/archiv.js` (`importiereArchiv`), geprüft im Test
„Archiv: Export, Übernahme in eine leere Instanz, gleiche Prüfsummen“. Nach der Übergabe die alte Instanz mit
`docker compose down -v` samt Volume löschen.

## Störungen

| Lage | Was tun |
|---|---|
| Anwendung antwortet nicht | `docker compose ps`, `docker compose logs --tail 200 spurensuche`; `docker compose restart spurensuche` |
| Anmeldedienst nicht erreichbar | Laufende Quests laufen weiter (Geräte arbeiten offline, übertragen später). Lehrkräfte melden sich mit Zugangsschlüssel an. |
| Datenbank beschädigt | anhalten, letzte Sicherung zurückspielen (oben), starten |
| Inhaltsfehler nach Austausch | `tools/pruefe-inhalte.js` zeigt Datei, Feld und Grund; vorherige Inhalte wiederherstellen |
| Platte voll | Sicherungen außer Haus kopieren, `SPUR_SICHERUNG_ANZAHL` senken |
| Verdacht auf Sicherheitsvorfall | Zugangsschlüssel in der Verwaltung sperren; `SPUR_VERWALTUNG_SCHLUESSEL` und Tokens in `.env` wechseln; alle Sitzungen beenden: `docker compose run --rm --entrypoint node spurensuche tools/sitzungen-beenden.js` (mit `--geraete` auch alle Gerätezugänge); neu starten; Vorfall binnen 24 Stunden melden |

## Schlüssel und Zertifikate

- TLS-Zertifikate verwaltet der Reverse Proxy; die Anwendung kennt sie nicht.
- Signaturschlüssel des Anmeldedienstes holt die Anwendung über dessen JWKS-Adresse; ein Schlüsselwechsel beim
  Anbieter wird beim nächsten unbekannten Schlüssel automatisch nachgeladen (ohne Neustart, getestet).
- Eigene Schlüssel (`SPUR_*`) liegen nur in `.env`; ein Wechsel braucht einen Neustart (`docker compose up -d`).
