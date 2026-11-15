# Messprotokoll 2026-11-15

> Erzeugt mit `tools/protokoll.js` aus den Dateien dieses Ordners. Stand des Codes: `02a07c7`.
> **Alle Nutzerinnen und Nutzer in diesen Messungen sind simuliert**: Ein Skript klickt im Browser oder schickt Anfragen.
> Es gab keine echten Schulklassen, Lehrkräfte oder Familien.

## Rechner

- Last vor dem Lauf: `03:04:34 up 15 days,  8:28, 10 users,  load average: 0.76, 1.05, 0.76` (rechner-vorher.txt)
- Last nach dem Lauf: `04:09:58 up 15 days,  9:34,  9 users,  load average: 0.15, 0.61, 0.89` (rechner-nachher.txt)
- Node.js im Container: v24.22.2 (node-version.txt)

## Automatische Tests

- **23 von 23** bestanden, 0 fehlgeschlagen, Dauer 0,6 s (tests.tap)

## Inhalte

- 4 Orte, 12 Aufgaben, 16 Sammelstücke geprüft: keine Fehler. (inhalte.txt)

## QR-Codes

- **17 von 17** QR-Codes des eigenen Erzeugers von einem fremden Decoder (zbar zbar-0.23.93-r1) korrekt gelesen; Versionen 1, 4, 5, 6, 7, 8, 9, 10 (qr/erwartet.json, qr/zbar.txt)

## Browser-Prüfläufe (Chrome ohne Oberfläche, simuliert)

### Instanz mit Testinhalten

- Schritte: 24 Bildschirmfotos, **0 Fehler** (browser/rauchtest.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **31 Ansichten, 0 mit Verstößen**
- Offline-Paket: 67 von 67 Dateien im Gerät, 0,3 MB
- Ohne Netz neu geladen und gespielt: ja
- Anzeige ohne Netz: „Offline · 4 warten“, nach Rückkehr des Netzes: „Alles übertragen“
- Auswertung danach: „3 Aufgaben gelöst bzw. entschieden, 3 Aufgaben bearbeitet.“ (ohne Doppelzählung)

### Vorführung mit echten Inhalten

- Schritte: 11 Bildschirmfotos, **0 Fehler** (browser/vorfuehrung.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **10 Ansichten, 0 mit Verstößen**
- Offline-Paket: 143 von 143 Dateien im Gerät, 4,4 MB
- Ohne Netz neu geladen und gespielt: ja

### alle Spiele der echten Inhalte

- Schritte: 12 Bildschirmfotos, **0 Fehler** (browser/spiele.json)
- axe-core 4.10.2 (WCAG 2.0/2.1 A und AA): **17 Ansichten, 0 mit Verstößen**

## Nachbau aus frischem Klon

- **2,2 s** vom Klonen bis zur ersten erfolgreichen Statusabfrage (Klonen 0,1 s, Bauen 1,2 s, Starten 0,9 s); Bau ohne Zwischenspeicher (--no-cache), Basis-Image neu geprüft (--pull); erste verschlüsselte Sicherung: ja (nachbau.json)
- Hinweis: Das Basis-Image `node:24-alpine` lag auf dem Prüfrechner schon vor; auf einem neuen Rechner kommt sein Herunterladen hinzu.

## Lasttest 400 Sitzungen (simuliert)

- Ablauf: 400 simulierte Gruppen-Geräte in 50 Klassen, Start in den ersten 5 Minuten, 45 Minuten Messdauer, Denkzeit je Aufgabe 30 bis 60 s (verdichtet gegenüber 5 bis 10 Minuten im Unterricht), je Gerät App und alle Inhalte geladen (137 Dateien, 4,4 MB), ein Bildbeitrag von 1,6 MB, Lehrkräfte rufen alle 10 s die Übersicht ab; Instanz begrenzt auf 2 CPU-Kerne und 2 GB (last-400.json)
- **Höchstens 400 Sitzungen gleichzeitig**, 101.451 Anfragen, **0 Fehler** (0,000 %), Dauer 2.760 s

| Anfrage | Anzahl | p50 | p95 | p99 | max | Fehler |
|---|---|---|---|---|---|---|
| seite | 400 | 1 ms | 1 ms | 5 ms | 13 ms | 0 |
| konfiguration | 400 | 0 ms | 0 ms | 3 ms | 8 ms | 0 |
| offline-liste | 400 | 0 ms | 1 ms | 1 ms | 2 ms | 0 |
| statisch | 54.800 | 1 ms | 3 ms | 4 ms | 19 ms | 0 |
| beitritt | 400 | 1 ms | 2 ms | 11 ms | 29 ms | 0 |
| sync | 30.191 | 1 ms | 2 ms | 12 ms | 52 ms | 0 |
| lk-uebersicht | 13.360 | 2 ms | 3 ms | 4 ms | 45 ms | 0 |
| lk-auswertung | 1.100 | 2 ms | 3 ms | 4 ms | 8 ms | 0 |
| bildbeitrag | 400 | 15 ms | 48 ms | 53 ms | 59 ms | 0 |

- Container während des Laufs (alle 10 s): CPU höchstens 8,5 % (200 % = 2 Kerne), Arbeitsspeicher zuletzt 56.62MiB (last-400-docker-stats.csv)

## Lasttest 600 Sitzungen (simuliert)

- Ablauf: 600 simulierte Gruppen-Geräte in 75 Klassen, Start in den ersten 5 Minuten, 15 Minuten Messdauer, Denkzeit je Aufgabe 30 bis 60 s (verdichtet gegenüber 5 bis 10 Minuten im Unterricht), je Gerät App und alle Inhalte geladen (137 Dateien, 4,4 MB), ein Bildbeitrag von 1,6 MB, Lehrkräfte rufen alle 10 s die Übersicht ab; Instanz begrenzt auf 2 CPU-Kerne und 2 GB (last-600.json)
- **Höchstens 600 Sitzungen gleichzeitig**, 105.651 Anfragen, **0 Fehler** (0,000 %), Dauer 959 s

| Anfrage | Anzahl | p50 | p95 | p99 | max | Fehler |
|---|---|---|---|---|---|---|
| lk-uebersicht | 6.573 | 2 ms | 3 ms | 9 ms | 41 ms | 0 |
| seite | 600 | 1 ms | 1 ms | 7 ms | 26 ms | 0 |
| konfiguration | 600 | 0 ms | 1 ms | 2 ms | 6 ms | 0 |
| offline-liste | 600 | 0 ms | 1 ms | 2 ms | 8 ms | 0 |
| statisch | 82.200 | 1 ms | 3 ms | 4 ms | 14 ms | 0 |
| beitritt | 600 | 1 ms | 2 ms | 4 ms | 26 ms | 0 |
| sync | 13.353 | 1 ms | 3 ms | 18 ms | 54 ms | 0 |
| lk-auswertung | 525 | 1 ms | 2 ms | 4 ms | 10 ms | 0 |
| bildbeitrag | 600 | 16 ms | 50 ms | 58 ms | 73 ms | 0 |

- Container während des Laufs (alle 10 s): CPU höchstens 13,0 % (200 % = 2 Kerne), Arbeitsspeicher zuletzt 75.89MiB (last-600-docker-stats.csv)

## Rückspieltest (auf der Datenbank des Lasttests)

- Datenbank 674,8 MB, 17 Tabellen, 86.475 Zeilen; Sicherung 2.812 ms, Rückspielen 2.857 ms; **alle Tabellen mit gleicher SHA-256-Prüfsumme** (rueckspiel.json)

## Archiv und Übergabe (auf der Datenbank des Lasttests)

- Export 98 Dateien (4,2 MB, davon 0 Bildbeiträge) in 39 ms; Prüfung nach BagIt ohne Fehler; Übernahme in leere Instanz 22 ms; **alle 98 Prüfsummen gleich** (archiv.json)

## Rückgabewerte der Schritte

```
tests=0
inhalte=0
qr=0
rauchtest=0
vorfuehrung=0
spiele=0
nachbau=0
last400=0
rueckspiel=0
archiv=0
last600=0
```

## Grenzen

- axe-core findet nur einen Teil der Barrierefreiheitsprobleme; ein Audit nach EN 301 549 ersetzt es nicht.
- Der Lasttest misst Server und Netz im selben Rechner; Funknetze an Schulen und Endgeräte sind nicht Teil der Messung.
- Dateien in diesem Ordner: archiv.json, archiv.log, browser, browser-rauchtest.log, browser-spiele.log, browser-vorfuehrung.log, inhalte.txt, last-400-docker-stats.csv, last-400-rechner.txt, last-400.json, last-400.log, last-600-docker-stats.csv, last-600-rechner.txt, last-600.json, last-600.log, messlauf.log, nachbau.json, nachbau.log, node-version.txt, qr, rechner-nachher.txt, rechner-vorher.txt, rueckgaben.txt, rueckspiel.json, rueckspiel.log, stand.txt, tests.tap
