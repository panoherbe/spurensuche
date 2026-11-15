# Betrieb (technisch)

Kurz: Ein Container für die Anwendung, einer für die tägliche verschlüsselte Sicherung, dazu ein kleiner
Betriebsdienst am Server. Für den Telefondienst gibt es die **Betriebsseite** `/betrieb.html` (Ampel und vier
sichere Knöpfe) und das Menü `betrieb/spur`; beides beschreibt [BETRIEBSHANDBUCH.md](BETRIEBSHANDBUCH.md) Schritt
für Schritt für Menschen ohne Entwicklerwissen. Dieses Dokument ist die technische Fassung für die Entwicklung.
Personenbezogene Daten gibt es fast keine (docs/DATENSCHUTZ.md); die Protokolle enthalten keine.

## Rollen und Werkzeuge

| Wer | Womit | Was |
|---|---|---|
| Telefondienst (Betrieb) | Betriebsseite `/betrieb.html`, Schlüssel `SPUR_BETRIEB_SCHLUESSEL` | Ampel lesen; neu starten; Sicherung anlegen und zurückspielen; Inhaltspaket prüfen, aktivieren, zurücknehmen; letzte Version zurückspielen. Sieht keine Lerngruppen, Ergebnisse oder Bilder. |
| Telefondienst im Notfall | `betrieb/spur` am Server (Menü mit Zahlen) | dasselbe ohne Browser, wenn die Seite nicht lädt |
| Verwaltung | `/verwaltung.html`, `SPUR_VERWALTUNG_SCHLUESSEL` | Zugangsschlüssel für Lehrkräfte, Archiv und Übergabe, QR-Schilder |
| Entwicklung | `betrieb/spur aktualisieren <tag>`, `.env`, dieses Dokument | neue Versionen, Schlüssel, Einrichtung |
| Betriebsdienst | `betrieb/spur wache` (systemd-Dienst `spurensuche-wache`) | führt „letzte Version zurückspielen“ aus; startet die Anwendung neu, wenn Docker sie 30 Sekunden lang als „unhealthy“ meldet |
| Alle | Statusseite `/status.html` | öffentlich, ohne Zahlen: läuft, läuft mit Einschränkungen, Störung |

**Sicherheit:** Die Anwendung hat keinen Zugriff auf Docker. Versionen wechselt nur der Betriebsdienst am Server:
Er fragt alle zehn Sekunden über `127.0.0.1` bei `/api/v1/betrieb/agent` nach Aufträgen (Bearer
`SPUR_BETRIEB_AGENT_TOKEN`) und führt ausschließlich die fest eingebaute Aktion `version-zurueck` aus; die Antwort
sind Textzeilen, die das Skript ohne weitere Werkzeuge liest. Ein Inhaltspaket enthält nie Programmcode (nur
JSON, Bilder, Töne, Schriften, Texte; SVG ohne Skript); Spiele kommen nur mit einer Version.

## Die Ampel

`GET /api/v1/betrieb/zustand` (Sitzung „betrieb“) liefert elf Punkte mit Stufe `gut`, `info`, `achtung` oder
`stoerung`, einem Wert, einer Erklärung und bei Gelb und Rot immer „Was tun“. Schwellen:

| Punkt | Gelb | Rot |
|---|---|---|
| Datenbank (`PRAGMA quick_check` alle 10 Minuten) | Zurückspielen fehlgeschlagen | Prüfung meldet Fehler |
| Sicherung | letzte älter als 26 Stunden | älter als 50 Stunden, keine nach 26 Stunden Laufzeit oder kein Schlüssel |
| Speicherplatz (Datenordner) | unter 15 % oder unter 2 GB frei | unter 5 % oder unter 0,5 GB |
| Fehler (letzte 15 Minuten, ab 20 Anfragen) | ab 0,5 % Antworten mit 5xx | ab 5 % |
| Antwortzeit (95. Perzentil, 15 Minuten) | über 250 ms | über 1 s |
| Arbeitsspeicher (Grenze des Containers) | über 70 % | über 90 % |
| Anmeldung über das Schulkonto (Discovery alle 5 Minuten) | nicht erreichbar | – (Lehrkräfte nutzen Zugangsschlüssel) |
| Inhalte | – | Inhaltsfehler oder aktives Paket nicht ladbar (dann läuft der mitgelieferte Inhalt) |
| Betriebsdienst | meldet sich nicht (über 60 Sekunden) | – |
| Zertifikat (eigene Adresse, alle 6 Stunden) | weniger als 21 Tage gültig | weniger als 7 Tage oder ungültig |

Dazu ein Verlauf der letzten 24 Stunden in Fünf-Minuten-Fenstern (Tabelle `messreihe`, 14 Tage aufbewahrt):
Anfragen, Fehler, Antwortzeit, aktive Gruppen, Speicher, CPU. Die öffentliche Statusseite nutzt nur
`GET /api/v1/status` (`betrieb.zustand`: `gut`, `eingeschraenkt`, `stoerung`).

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

Besondere Sicherungen tragen ihre Art im Namen (`…-hand`, `…-vor-zurueckspielen`, `…-vor-aktualisierung`); von
jeder Art bleiben die neuesten zehn, getrennt von den täglichen.

## Rückspielen

Über die Betriebsseite: Die Anwendung entschlüsselt und prüft die gewählte Sicherung neben der Datenbank
(`spurensuche.db.zurueck`, GCM-Prüfwert und `PRAGMA integrity_check`), sichert den jetzigen Stand
(`…-vor-zurueckspielen`), merkt das Zurückspielen vor (`zurueckspielen.json`) und beendet sich. Docker startet sie
neu; beim Start ersetzt `server/start.js` die Datenbank, bevor sie geöffnet wird, und übernimmt die Sitzungen des
Betriebs. Schlägt die Prüfung fehl, ändert sich nichts.

Am Server: `betrieb/spur zurueckspielen` (Auswahl aus der Liste) oder von Hand:

```bash
docker compose stop spurensuche sicherung
docker compose run --rm --entrypoint node spurensuche tools/rueckspielen.js \
  spurensuche-20261124-020000.db.enc --ziel /daten/spurensuche.db --ueberschreiben --vorher-sichern
docker compose up -d
```

Der Rückspieltest (`nachweis/`) vergleicht jede Tabelle des Originals mit der zurückgespielten Fassung über SHA-256.

## Versionen: aktualisieren und zurück

Das Bild `spurensuche:aktuell` ist die laufende Version; jede Version hat zusätzlich ihr eigenes Bild
(`spurensuche:0.2.0`). `betrieb/versionen` listet die installierten Versionen, die letzte Zeile läuft.

```bash
betrieb/spur aktualisieren v0.2.0    # Sicherung vorher, Bild aus dem Git-Tag bauen, starten, prüfen
betrieb/spur zurueck                 # auf die Version davor (auch über die Betriebsseite)
betrieb/spur versionen
```

`aktualisieren` baut aus `git archive <tag>` (der Arbeitsordner bleibt unberührt), setzt das Bild auf „aktuell“
und wartet bis zu 90 Sekunden auf die Antwort der neuen Version. Kommt sie nicht, geht es **automatisch** zurück auf
die laufende Version. `compose.yaml` selbst ändert sich dabei nicht; Änderungen daran kommen mit `git pull`.

**Regel für die Entwicklung:** Das Datenbankschema wird nur erweitert (neue Tabellen und Spalten, nie umbenennen
oder löschen). Dann läuft eine ältere Version auf der neueren Datenbank weiter, und „Version zurück“ braucht kein
Zurückspielen von Daten. Muss eine Version das brechen, gehört das in die Ankündigung, und vor dem Zurück die
Sicherung `…-vor-aktualisierung` zurückspielen.

## Inhalte tauschen

Über die Betriebsseite („Inhalt tauschen“): Ein Inhaltspaket ist ein ZIP mit dem ganzen Ordner `inhalte/` und
`assets/spiele/` (ungepackt oder „deflate“, ein gemeinsamer oberster Ordner ist erlaubt). Die Anwendung prüft vor
dem Ablegen: Grenzen (3000 Dateien, 30 MB je Datei, 300 MB ausgepackt, Prüfsumme je Datei), Pfade, erlaubte
Dateitypen, SVG ohne Skript; danach mit `pruefeInhalte` jedes Pflichtfeld, jeden Verweis auf Bilder und Sammelstücke
und das Format jeder Aufgabe gegen die Spiele der laufenden Version. Laufende Quests, deren Aufgaben im neuen
Inhalt fehlen, werden als Warnung genannt. Erst „Aktivieren“ schaltet um (ohne Neustart); `inhalte-pakete/aktiv.json`
merkt das aktive und das vorherige Paket. Die neuesten fünf Pakete bleiben. Ist das aktive Paket beim Start nicht
ladbar, läuft der mitgelieferte Inhalt und die Ampel zeigt Rot.

Pakete baut das Redaktionsteam aus einem Checkout: `node tools/inhalt-paket.js <ziel.zip>` (prüft vorher).

Geräte laden die neue Fassung beim nächsten Öffnen mit Netz vollständig nach. Ohne Betriebsseite: Inhalte im
Ordner aus `SPUR_INHALTE` ersetzen und in der Verwaltung „Inhalte neu laden und prüfen“ wählen.

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
| Anwendung antwortet nicht | `betrieb/spur status`, `docker compose logs --tail 200 spurensuche`; `betrieb/spur neustart`. Hängt sie, startet der Betriebsdienst sie nach 30 Sekunden „unhealthy“ selbst neu (gemessen vom Anhalten bis zur Antwort: 114 s, `nachweis/2026-11-15/betrieb/betriebstest.json`). |
| Neue Version startet nicht | Nichts tun: `betrieb/spur aktualisieren` kehrt nach 90 Sekunden selbst zurück. Danach `docker compose logs` der neuen Version lesen. |
| Anmeldedienst nicht erreichbar | Laufende Quests laufen weiter (Geräte arbeiten offline, übertragen später). Lehrkräfte melden sich mit Zugangsschlüssel an. |
| Datenbank beschädigt | Betriebsseite: „Sicherung zurückspielen“ (oder `betrieb/spur zurueckspielen`) |
| Inhaltsfehler nach Austausch | Betriebsseite: „Vorherigen Inhalt wiederherstellen“; die Fehlerliste nennt Datei, Feld und Grund |
| Platte voll | Sicherungen außer Haus kopieren, `SPUR_SICHERUNG_ANZAHL` senken |
| Verdacht auf Sicherheitsvorfall | Zugangsschlüssel in der Verwaltung sperren; `SPUR_VERWALTUNG_SCHLUESSEL` und Tokens in `.env` wechseln; alle Sitzungen beenden: `docker compose run --rm --entrypoint node spurensuche tools/sitzungen-beenden.js` (mit `--geraete` auch alle Gerätezugänge); neu starten; Vorfall binnen 24 Stunden melden |

## Schlüssel und Zertifikate

- TLS-Zertifikate verwaltet der Reverse Proxy; die Anwendung kennt sie nicht.
- Signaturschlüssel des Anmeldedienstes holt die Anwendung über dessen JWKS-Adresse; ein Schlüsselwechsel beim
  Anbieter wird beim nächsten unbekannten Schlüssel automatisch nachgeladen (ohne Neustart, getestet).
- Eigene Schlüssel (`SPUR_*`) liegen nur in `.env`; ein Wechsel braucht einen Neustart (`docker compose up -d`).
