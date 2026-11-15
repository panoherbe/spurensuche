# Nachmessung nach der schlichteren Gestaltung, 15.11.2026

Am Abend des 15.11.2026 wurde nur die Gestaltung der App geändert, im Commit `c7d0532`:

- kleinere Ecken: 6 statt 14 px, klein 4 statt 10 px
- keine weichen Schatten
- Knöpfe ohne Pillenform
- Startseite ohne Farbverlauf
- Kopfleiste deckend statt mit Glaseffekt
- Hinweise und Prüfpunkte mit Rahmen rundum statt einem farbigen Rand links

Farben, Texte und Abläufe sind unverändert. Die Dateien in `spiele/` sind ebenfalls unverändert; die Spiele übernehmen
über `--sp-radius` aber die kleineren Ecken.

## Messung

Auf diesem Stand liefen am 15.11.2026 von 19:54 bis 19:57 Uhr alle Prüfungen des Messlaufs, die die Oberfläche betreffen.

- Rechner, Container-Aufbau (`compose.test.yaml`, `compose.betrieb.yaml`) und Aufrufe waren dieselben wie im offiziellen
  Messlauf (`../2026-11-15-gesamt/`, `tools/messlauf.sh`).
- Jede Zahl unten steht in der genannten Datei.
- Die Barrierefreiheit prüfte axe-core 4.10.2 nach den Regeln für WCAG 2.1 AA.

| Prüfung | Ergebnis | Datei |
|---|---|---|
| automatische Tests | 33 von 33 bestanden | `tests.tap` |
| Instanz mit Testinhalten im Browser | 24 Schritte, keiner mit Fehler; 31 Ansichten, 0 Verstöße | `browser/rauchtest.json` |
| Vorführung im Browser | 14 Schritte, keiner mit Fehler; 14 Ansichten, 0 Verstöße | `browser/vorfuehrung.json` |
| alle Spiele der echten Inhalte im Browser | 12 Schritte, keiner mit Fehler; 17 Ansichten, 0 Verstöße | `browser/spiele.json` |
| Betriebsseite im Browser | 8 Schritte, keiner mit Fehler; 15 Ansichten, 0 Verstöße | `browser/betrieb-seite.json` |
| Bilder für das README | fünf Bilder in `browser/konzept/`; `konzeptbilder.json` meldet keine Fehler (Schritte führt es nicht auf) | `browser/konzept/`, `browser/konzeptbilder.json` |

Zusammen sind das 77 Ansichten mit 0 Verstößen, so viele wie im offiziellen Messlauf.

Die Bilder `medien/1-karte.png` bis `medien/4-kompetenzraster.png` sind `browser/konzept/` in halber Größe
(820 × 1180), ohne Metadaten.

## Nicht wiederholt

- Lasttest, Betriebstest, Sicherung, Archiv und Nachbau: Sie berühren die Gestaltung nicht. Ihre Zahlen gelten aus dem
  offiziellen Messlauf.
- Der eigene Prüflauf der Spiele (`spiele/_pruefung/`): 81 Läufe nur mit der Tastatur in drei Browsern und
  537 axe-Zustände. Seine Zahlen gelten aus `spiele/_nachweis/2026-11-15/`.

Wie dort sind Spielstand und Gruppen simuliert: Ein Skript setzt sie in der Vorführung ein, es gab keine echte Klasse.
