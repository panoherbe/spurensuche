# Messprotokoll 2026-11-15-gesamt

> Erzeugt mit `tools/protokoll.js` aus den Dateien dieses Ordners. Stand des Codes: `33ee143`.
> **Alle Nutzerinnen und Nutzer in diesen Messungen sind simuliert**: Ein Skript klickt im Browser oder schickt Anfragen.
> Es gab keine echten Schulklassen, Lehrkräfte oder Familien.

## Rechner

- Last vor dem Lauf: `14:07:53 up 15 days, 19:32,  9 users,  load average: 0.09, 0.23, 0.27` (rechner-vorher.txt)
- Last nach dem Lauf: `15:19:46 up 15 days, 20:44,  9 users,  load average: 0.20, 0.27, 0.34` (rechner-nachher.txt)
- Node.js im Container: v24.22.2 (node-version.txt)

## Automatische Tests

- **33 von 33** bestanden, 0 fehlgeschlagen, Dauer 3,6 s (tests.tap)

## Inhalte

- 4 Orte, 12 Aufgaben, 16 Sammelstücke geprüft: keine Fehler. (inhalte.txt)

## QR-Codes

- **17 von 17** QR-Codes des eigenen Erzeugers von einem fremden Decoder (zbar zbar-0.23.93-r1) korrekt gelesen; Versionen 1, 4, 5, 6, 7, 8, 9, 10 (qr/erwartet.json, qr/zbar.txt)

## Browser-Prüfläufe (Chrome ohne Oberfläche, simuliert)

### Instanz mit Testinhalten

- Schritte: 24 Bildschirmfotos, **0 Fehler** (browser/rauchtest.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **31 Ansichten, 0 mit Verstößen**
- Offline-Paket: 70 von 70 Dateien im Gerät, 0,4 MB
- Ohne Netz neu geladen und gespielt: ja
- Anzeige ohne Netz: „Offline · 4 warten“, nach Rückkehr des Netzes: „Alles übertragen“
- Auswertung danach: „3 Aufgaben gelöst bzw. entschieden, 3 Aufgaben bearbeitet.“ (ohne Doppelzählung)

### Vorführung mit echten Inhalten

- Schritte: 14 Bildschirmfotos, **0 Fehler** (browser/vorfuehrung.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **14 Ansichten, 0 mit Verstößen**
- Offline-Paket: 147 von 147 Dateien im Gerät, 4,5 MB
- Ohne Netz neu geladen und gespielt: ja

### alle Spiele der echten Inhalte

- Schritte: 12 Bildschirmfotos, **0 Fehler** (browser/spiele.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **17 Ansichten, 0 mit Verstößen**

### Betriebsseite (Knöpfe wirklich gedrückt)

- Schritte: 8 Bildschirmfotos, **0 Fehler** (browser/betrieb-seite.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **15 Ansichten, 0 mit Verstößen**
- Neustart über den Knopf: wieder erreichbar nach **1,0 s** (vom Klick bis zur Meldung der Seite; Docker startet den Container neu)
- Sicherung zurückspielen über den Knopf: **1,1 s** bis zur Meldung; danach Lerngruppen ["Klasse 6a vor der Sicherung"] (vorher ["Klasse 6a vor der Sicherung","Klasse 6b nach der Sicherung"])
- Inhalt tauschen: Paket geprüft und aktiviert (Ort heißt „Testort Nord (aus dem Paket)“), fehlerhaftes Paket abgelehnt, vorheriger Inhalt wiederhergestellt („Testort Nord“)
- Letzte Version zurückspielen: Auftrag bis „Erledigt“ 2,0 s (Betriebsdienst in diesem Lauf nachgestellt; echter Wechsel unten im Betriebstest)

## Betriebstest: Werkzeug betrieb/spur und Betriebsdienst (simuliert, echte Container)

- Einrichten (Schlüssel erzeugen, bauen, starten): 3,0 s; Docker 29.1.3 (betriebstest.json)
- Neu starten: **1,3 s** bis die Anwendung wieder antwortet; Daten danach vollständig
- Sicherung anlegen: 0,3 s; Sicherung zurückspielen: **12,2 s**, danach Stand der Sicherung, jetziger Stand vorher gesichert
- Neue Version einspielen (bauen, Sicherung vorher, starten): 12,5 s
- Letzte Version zurück über die Betriebsseite und den Betriebsdienst: **31,1 s** vom Knopf bis „Erledigt“ (Status fertig; 0 Sekunden ohne Antwort)
- Defekte neue Version: automatisch zurück auf die laufende Version: ja nach 114,2 s
- Hänger (Prozess angehalten): vom Betriebsdienst erkannt und neu gestartet nach **112,2 s**
- **0 Fehler** in den Prüfungen (betriebstest.log)

## Nachbau aus frischem Klon

- **2,3 s** vom Klonen bis zur ersten erfolgreichen Statusabfrage (Klonen 0,2 s, Bauen 1,3 s, Starten 0,9 s); Bau ohne Zwischenspeicher (--no-cache), Basis-Image neu geprüft (--pull); erste verschlüsselte Sicherung: ja (nachbau.json)
- Hinweis: Das Basis-Image `node:24-alpine` lag auf dem Prüfrechner schon vor; auf einem neuen Rechner kommt sein Herunterladen hinzu.

## Lasttest 400 Sitzungen (simuliert)

- Ablauf: 400 simulierte Gruppen-Geräte in 50 Klassen, Start in den ersten 5 Minuten, 45 Minuten Messdauer, Denkzeit je Aufgabe 30 bis 60 s (verdichtet gegenüber 5 bis 10 Minuten im Unterricht), je Gerät App und alle Inhalte geladen (147 Dateien, 4,5 MB), ein Bildbeitrag von 1,6 MB, Lehrkräfte rufen alle 10 s die Übersicht ab; Instanz begrenzt auf 2 CPU-Kerne und 2 GB (last-400.json)
- **Höchstens 400 Sitzungen gleichzeitig**, 105.566 Anfragen, **0 Fehler** (0,000 %), Dauer 2.759 s

| Anfrage | Anzahl | p50 | p95 | p99 | max | Fehler |
|---|---|---|---|---|---|---|
| seite | 400 | 1 ms | 2 ms | 4 ms | 49 ms | 0 |
| konfiguration | 400 | 0 ms | 1 ms | 2 ms | 7 ms | 0 |
| offline-liste | 400 | 0 ms | 1 ms | 1 ms | 3 ms | 0 |
| statisch | 58.800 | 1 ms | 3 ms | 5 ms | 44 ms | 0 |
| beitritt | 400 | 1 ms | 1 ms | 4 ms | 28 ms | 0 |
| sync | 30.287 | 1 ms | 2 ms | 17 ms | 162 ms | 0 |
| lk-uebersicht | 13.379 | 2 ms | 3 ms | 4 ms | 120 ms | 0 |
| lk-auswertung | 1.100 | 2 ms | 3 ms | 4 ms | 6 ms | 0 |
| bildbeitrag | 400 | 14 ms | 48 ms | 54 ms | 57 ms | 0 |

- Container während des Laufs (alle 10 s): CPU höchstens 18,0 % (200 % = 2 Kerne), Arbeitsspeicher zuletzt 63.24MiB (last-400-docker-stats.csv)

## Lasttest 600 Sitzungen (simuliert)

- Ablauf: 600 simulierte Gruppen-Geräte in 75 Klassen, Start in den ersten 5 Minuten, 15 Minuten Messdauer, Denkzeit je Aufgabe 30 bis 60 s (verdichtet gegenüber 5 bis 10 Minuten im Unterricht), je Gerät App und alle Inhalte geladen (147 Dateien, 4,5 MB), ein Bildbeitrag von 1,6 MB, Lehrkräfte rufen alle 10 s die Übersicht ab; Instanz begrenzt auf 2 CPU-Kerne und 2 GB (last-600.json)
- **Höchstens 600 Sitzungen gleichzeitig**, 111.646 Anfragen, **0 Fehler** (0,000 %), Dauer 959 s

| Anfrage | Anzahl | p50 | p95 | p99 | max | Fehler |
|---|---|---|---|---|---|---|
| seite | 600 | 1 ms | 1 ms | 6 ms | 26 ms | 0 |
| konfiguration | 600 | 0 ms | 1 ms | 1 ms | 4 ms | 0 |
| offline-liste | 600 | 0 ms | 1 ms | 1 ms | 4 ms | 0 |
| statisch | 88.200 | 1 ms | 3 ms | 4 ms | 38 ms | 0 |
| beitritt | 600 | 1 ms | 1 ms | 5 ms | 22 ms | 0 |
| sync | 13.332 | 1 ms | 4 ms | 19 ms | 61 ms | 0 |
| lk-uebersicht | 6.589 | 2 ms | 3 ms | 15 ms | 50 ms | 0 |
| lk-auswertung | 525 | 1 ms | 2 ms | 5 ms | 6 ms | 0 |
| bildbeitrag | 600 | 14 ms | 43 ms | 51 ms | 54 ms | 0 |

- Container während des Laufs (alle 10 s): CPU höchstens 13,6 % (200 % = 2 Kerne), Arbeitsspeicher zuletzt 77.8MiB (last-600-docker-stats.csv)

## Rückspieltest (auf der Datenbank des Lasttests)

- Datenbank 674,9 MB, 19 Tabellen, 86.763 Zeilen; Sicherung 2.665 ms, Rückspielen 1.577 ms; **alle Tabellen mit gleicher SHA-256-Prüfsumme** (rueckspiel.json)

## Archiv und Übergabe (auf der Datenbank des Lasttests)

- Export 99 Dateien (4,2 MB, davon 0 Bildbeiträge) in 34 ms; Prüfung nach BagIt ohne Fehler; Übernahme in leere Instanz 22 ms; **alle 99 Prüfsummen gleich** (archiv.json)

## Rückgabewerte der Schritte

```
tests=0
inhalte=0
qr=0
rauchtest=0
vorfuehrung=0
spiele=0
konzeptbilder=1
betriebsseite=0
betriebstest=0
nachbau=0
last400=0
rueckspiel=0
archiv=0
last600=0
protokoll=0
```

## Grenzen

- axe-core findet nur einen Teil der Barrierefreiheitsprobleme; ein Audit nach EN 301 549 ersetzt es nicht.
- Der Lasttest misst Server und Netz im selben Rechner; Funknetze an Schulen und Endgeräte sind nicht Teil der Messung.
- Dateien in diesem Ordner: archiv.json, archiv.log, betriebstest-ausgabe.log, betriebstest-spur.log, betriebstest-wache.log, betriebstest.json, betriebstest.log, browser, browser-betrieb.log, browser-konzeptbilder.log, browser-rauchtest.log, browser-spiele.log, browser-vorfuehrung.log, inhalte.txt, last-400-docker-stats.csv, last-400-rechner.txt, last-400.json, last-400.log, last-600-docker-stats.csv, last-600-rechner.txt, last-600.json, last-600.log, messlauf.log, nachbau.json, nachbau.log, node-version.txt, qr, rechner-nachher.txt, rechner-vorher.txt, rueckgaben.txt, rueckspiel.json, rueckspiel.log, stand.txt, tests.tap
