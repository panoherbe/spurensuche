# Nachmessung nach der Gestaltung für Kinder, 16.11.2026

In der Nacht zum 16.11.2026 bekam die App eine neue Gestaltung, die nach Abenteuer für Schulkinder aussieht
(Commits `8ab8c2d`, `294619f`, `1f10db5`, `d73a042`, dazu die Korrektur `1cffbad`, siehe unten).

- **Farben:** Himmelblau als Grund, Sonnengelb für Kopfleiste, Hauptknöpfe und Sterne, dunkle Tinte für Schrift und
  Umrisse; dazu eine eigene Farbe für jeden Ort. Dunkle Darstellung und hoher Kontrast haben eigene Werte.
- **Formen:** Flächen und Knöpfe mit 3 px Umriss und festem Schatten, große runde Knöpfe. Keine Verläufe, kein Glas.
- **Schrift:** Überschriften und Knöpfe in Grandstander (`app/schrift/`, SIL OFL 1.1, Lizenztext daneben). Der Lesetext
  bleibt in Atkinson Hyperlegible Next.
- **Zeichnungen:** eigene SVG-Zeichnungen (`app/js/zeichnungen.js`): Tierwappen der Gruppen, Wimpel, Stern, Stempel,
  Konfetti, Bäume, Berge und Windrose der Karte, Sonne und Wolken.
- **Bildschirme:** Entdeckerkarte mit gezeichnetem Weg und runden Bildmarken, Sammelbuch mit Stickern je Ort, eine
  Feier nach jeder Aufgabe, die Figur der Gruppe auf der Karte.

Texte, Abläufe, Daten und Schnittstellen sind unverändert. Die Spiele übernehmen Farben, Umriss und Schrift über die
Variablen der App; dafür wurden `spiele/_gemeinsam/basis.css` und in `1cffbad` zwei Stildateien der Spiele angepasst.

## Messung

Auf dem Stand `1cffbad` (`stand.txt`) liefen am 16.11.2026 von 13:38 bis 13:50 Uhr alle Prüfungen des Messlaufs, die
die Oberfläche betreffen, dazu der eigene Prüflauf der Spiele.

- Rechner, Container-Aufbau (`compose.test.yaml`, `compose.betrieb.yaml`) und Aufrufe waren dieselben wie im offiziellen
  Messlauf (`../2026-11-15-gesamt/`, `tools/messlauf.sh`). Jeder Schritt endete mit Rückgabe 0 (`rueckgaben.txt`).
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

Zusammen sind das 77 Ansichten mit 0 Verstößen, so viele wie im offiziellen Messlauf und in der Nachmessung vom
15.11.2026 (`../2026-11-15-gestaltung/`).

**Von axe als „unvollständig“ gemeldet** (Stellen, die axe nicht selbst entscheiden kann und die ein Mensch ansehen
muss, etwa Kontrast über einem Foto): 16 Stellen, am 15.11.2026 waren es 17.

| Prüflauf | 15.11.2026 (`b34b4bd`) | 16.11.2026 (`1cffbad`) |
|---|---|---|
| Instanz mit Testinhalten | 8 | 7 |
| Vorführung | 4 | 4 |
| Spiele | 0 | 0 |
| Betriebsseite | 5 | 5 |

Die Zahlen stehen je Ansicht unter `barrierefreiheit` in den vier Dateien in `browser/` (hier und in
`../2026-11-15-gestaltung/browser/`). Weggefallen ist die Stelle in der dunklen Startseite auf dem Telefon.

**Offline-Paket der Vorführung:** 155 Dateien mit 4.910.612 Bytes (4,7 MB, `browser/vorfuehrung.json`,
`messung.offlinePaket`). Am 15.11.2026 abends waren es 150 Dateien mit 4.780.307 Bytes, im offiziellen Messlauf
147 Dateien mit 4.721.242 Bytes. Dazugekommen sind die zwei Schriftdateien von Grandstander, ihr Lizenztext und zwei
Skripte (`zeichnungen.js`, `figurbild.js`). In der Instanz mit Testinhalten sind es 78 Dateien statt 73
(`browser/rauchtest.json`).

## Eigener Prüflauf der Spiele

Derselbe Prüflauf wie in `../../spiele/_nachweis/2026-11-15/`, am 16.11.2026 von 13:41 bis 13:50 Uhr auf `1cffbad`.
Die Dateien liegen im Unterordner `spiele/` dieses Ordners (`messwerte.json`, Abschnitt `zusammenfassung`; `tests.tap`).

- Logik und Inhalte: 22 von 22 Tests bestanden.
- Spiele im Browser, nur mit der Tastatur, in Chromium, Firefox und WebKit: 81 von 81 Läufen gelöst.
- axe-core 4.14.0 (WCAG 2.0, 2.1 und 2.2, A und AA) prüfte 537 Zustände: 0 Verstöße.
- Text über den Kartenrand oder abgeschnitten: 0 Stellen; auf den Testseiten von Collage und Figur ebenfalls 0.
- Startkarten in 13 Fensterbreiten von 320 bis 1280 px: 432 Proben, 0 mit Überlauf.
- Schemafehler 0, Ereignisse außerhalb der Schnittstelle 0, Konsolenmeldungen 33 (wie am 15.11.2026).

**Erster Lauf mit Befund.** Der erste Prüflauf auf `d73a042` (16.11.2026, 00:40 bis 00:48 Uhr) fand 2 Stellen mit
Überlauf: Im Dilemma, Schritt „Abstimmen“, ragte bei 320 px Fensterbreite der Hinweistext 2 px über den Rand
(Aufgaben `bastei/3` und `frauenkirche/3`, `spiele/erster-lauf-d73a042.json`). Ursache war der dickere Umriss der
Karten: Er lässt bei 320 px weniger Platz als die 260 px, die eine Antwortkarte mindestens beanspruchte. Seit `1cffbad`
ist eine Antwortkarte höchstens so breit wie die Spielkarte (Dilemma und Schätzen); bei breiteren Fenstern ändert sich
nichts. Danach liefen alle Prüfungen oben noch einmal, auf `1cffbad`.

## Bilder und Rundgang

- `medien/1-karte.png` bis `medien/4-kompetenzraster.png` sind `browser/konzept/` in halber Größe (820 × 1180), ohne
  Metadaten.
- `medien/rundgang.mp4`, `medien/rundgang.gif` und `medien/poster.png`: neuer Rundgang aus Sicht einer Schülergruppe,
  aufgenommen am 16.11.2026 in der Vorführung auf `1cffbad`. Sechs Szenen, je ein kurzer Satz, 68 Sekunden, ohne Ton.
  MP4 1280 × 800, 2.808.701 Bytes; GIF 800 × 500, 3.176.804 Bytes. Der Spielstand in Szene 5 ist für den Rundgang
  vorbereitet, die Gruppen in Szene 6 sind simuliert; beides steht im Video.

## Nicht wiederholt

Lasttest, Betriebstest, Sicherung, Archiv und Nachbau: Sie berühren die Gestaltung nicht. Ihre Zahlen gelten aus dem
offiziellen Messlauf (`../2026-11-15-gesamt/`).

Wie dort sind Spielstand und Gruppen simuliert: Ein Skript setzt sie in der Vorführung ein, es gab keine echte Klasse.
