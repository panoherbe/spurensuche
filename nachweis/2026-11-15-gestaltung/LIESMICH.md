# Nachmessung nach der neuen Gestaltung, 15.11.2026

Am Abend des 15.11.2026 wurde die Gestaltung der App in zwei Schritten geändert.

1. `c7d0532`, schlichter:
   - keine weichen Schatten, keine Pillenknöpfe, kein Farbverlauf, keine gläserne Kopfleiste
   - Hinweise und Prüfpunkte mit Rahmen rundum statt einem farbigen Rand links
2. `b34b4bd`, eigene Schrift und weichere Formen:
   - **Schrift:** Atkinson Hyperlegible Next in der App (`app/schrift/`, SIL OFL 1.1, Lizenztext daneben). Sie ist
     gut lesbar, auch bei Sehschwäche, und hat die sorbischen Buchstaben. Vorher stand die Schrift des Systems.
   - **Formen:** Ecken 12 px, klein 8 px; feine Schatten in zwei Ebenen; Kopfleiste auf der Fläche.
   - Pillen, Verläufe, Glas und farbige Ränder links bleiben weg.

Farben, Texte und Abläufe sind unverändert. Die Dateien in `spiele/` sind ebenfalls unverändert; die Spiele übernehmen
über die Variablen der App aber Schrift und Ecken.

## Messung

Auf dem Stand `b34b4bd` liefen am 15.11.2026 von 20:54 bis 20:58 Uhr alle Prüfungen des Messlaufs, die die Oberfläche betreffen.

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

Zusammen sind das 77 Ansichten mit 0 Verstößen, so viele wie im offiziellen Messlauf. Das Offline-Paket der
Vorführung hat jetzt 150 Dateien mit 4.780.307 Bytes (4,6 MB, `browser/vorfuehrung.json`, `messung.offlinePaket`); im
offiziellen Messlauf waren es 147 Dateien mit 4.721.242 Bytes. Dazugekommen sind die zwei Schriftdateien und ihr Lizenztext.

Die Bilder `medien/1-karte.png` bis `medien/4-kompetenzraster.png` sind `browser/konzept/` in halber Größe
(820 × 1180), ohne Metadaten.

## Nicht wiederholt

- Lasttest, Betriebstest, Sicherung, Archiv und Nachbau: Sie berühren die Gestaltung nicht. Ihre Zahlen gelten aus dem
  offiziellen Messlauf.
- Der eigene Prüflauf der Spiele (`spiele/_pruefung/`): 81 Läufe nur mit der Tastatur in drei Browsern und
  537 axe-Zustände. Seine Zahlen gelten aus `spiele/_nachweis/2026-11-15/`.

Wie dort sind Spielstand und Gruppen simuliert: Ein Skript setzt sie in der Vorführung ein, es gab keine echte Klasse.
