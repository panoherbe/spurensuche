# Zweite Nachmessung am 16.11.2026: Karte, Vorführung, Sammelbild

Nach der Gestaltung für Kinder (`../2026-11-16-kinder/`) hat eine unabhängige Endprüfung am 16.11.2026 kleine Punkte
gefunden. Sie sind in den Commits `7a671c7` und `5e1df13` behoben:

- **Kopfleiste der Vorführung:** Dort steht jetzt „Alles gespeichert“ (mit Haken) statt „Alles übertragen“. Die
  Vorführung hat keinen Server; alles bleibt im Browser. Mit Server bleibt es bei „Alles übertragen“.
- **Sammelbild:** Das Bild der Gruppe heißt in der App und als Beschriftung im Bild „Sammelbild“ statt
  „Item-Collage“. Der Wert in der Schnittstelle (`item-collage`) ist unverändert.
- **Ortsseite:** Unter dem Foto steht „Foto: …“ statt „Bild: Foto: …“.
- **Karte:** Stadtnamen, die eine Ortsmarke verdecken würde oder die über den Rand ragen, stehen links vom Punkt oder
  werden ausgeblendet. Ein Namensschild über dem Bild einer anderen Marke rückt zur Seite, ein Stempel (geschaffter
  Ort) auf die andere Seite seiner Marke. Die Marke der Bastei rückt in der Anzeige ein Stück von der Frauenkirche weg,
  damit sich die beiden runden Bilder nicht überdecken; die Lage im Inhalt bleibt.
- **Texte:** `spiele/README.md` nennt die Schrift Grandstander, im Bildnachweis fehlt eine Leerzeile.

## Messung

Auf dem Stand `5e1df13` (`stand.txt`) liefen am 16.11.2026 von 16:36 bis 16:49 Uhr dieselben Prüfungen wie in
`../2026-11-16-kinder/`: alle Prüfläufe des Messlaufs, die die Oberfläche betreffen, dazu der eigene Prüflauf der
Spiele. Rechner, Container-Aufbau und Aufrufe waren dieselben. Jeder Schritt endete mit Rückgabe 0
(`rueckgaben.txt`; die Uhrzeiten in `messlauf.log` sind Weltzeit, eine Stunde früher).

| Prüfung | Ergebnis | Datei |
|---|---|---|
| automatische Tests | 33 von 33 bestanden | `tests.tap` |
| Instanz mit Testinhalten im Browser | 24 Schritte, keiner mit Fehler; 31 Ansichten, 0 Verstöße | `browser/rauchtest.json` |
| Vorführung im Browser | 14 Schritte, keiner mit Fehler; 14 Ansichten, 0 Verstöße | `browser/vorfuehrung.json` |
| alle Spiele der echten Inhalte im Browser | 12 Schritte, keiner mit Fehler; 17 Ansichten, 0 Verstöße | `browser/spiele.json` |
| Betriebsseite im Browser | 8 Schritte, keiner mit Fehler; 15 Ansichten, 0 Verstöße | `browser/betrieb-seite.json` |
| Bilder für das README | fünf Bilder in `browser/konzept/`; `konzeptbilder.json` meldet keine Fehler | `browser/konzept/`, `browser/konzeptbilder.json` |

Zusammen 77 Ansichten mit 0 Verstößen (axe-core 4.10.2, Regeln für WCAG 2.1 AA), wie in `../2026-11-16-kinder/`. Von axe
als „unvollständig“ gemeldet: 16 Stellen (7 + 4 + 0 + 5), wie dort.

**Offline-Paket der Vorführung:** 155 Dateien mit 4.915.380 Bytes (4,7 MB, `browser/vorfuehrung.json`,
`messung.offlinePaket`); in `../2026-11-16-kinder/` 4.910.612 Bytes. Die 4.768 Bytes mehr sind der geänderte Code, vor
allem der Karte.
In der Instanz mit Testinhalten 78 Dateien wie dort. Im Rauchtest (mit Server) zeigt die Kopfleiste nach dem
Wiederverbinden weiter „Alles übertragen“ (`browser/rauchtest.json`, `messung.nachOnline`).

**Erster Lauf:** Ein Lauf auf `7a671c7` (16:18 bis 16:30 Uhr, vor dem Stempel-Commit) ergab dieselben Zahlen bis auf
das Paket (4.914.318 Bytes). Weil `5e1df13` danach noch die Karte änderte, liefen alle Prüfungen und der Rundgang noch
einmal. Die Dateien jenes Laufs liegen nicht im Repository.

## Eigener Prüflauf der Spiele

Derselbe Prüflauf wie in `../2026-11-16-kinder/spiele/`, am 16.11.2026 von 16:40 bis 16:49 Uhr auf `5e1df13`. Die
Dateien liegen in `spiele/` (`messwerte.json`, Abschnitt `zusammenfassung`; `tests.tap`).

- Logik und Inhalte: 22 von 22 Tests bestanden.
- Spiele im Browser, nur mit der Tastatur, in Chromium, Firefox und WebKit: 81 von 81 Läufen gelöst.
- axe-core 4.14.0 (WCAG 2.0, 2.1 und 2.2, A und AA) prüfte 537 Zustände: 0 Verstöße.
- Text über den Kartenrand oder abgeschnitten: 0 Stellen; auf den Testseiten von Collage und Figur ebenfalls 0.
- Startkarten in 13 Fensterbreiten von 320 bis 1280 px: 432 Proben, 0 mit Überlauf.
- Schemafehler 0, Ereignisse außerhalb der Schnittstelle 0, Konsolenmeldungen 33 (wie zuvor).

## Karte in sechs Fenstergrößen

Zusätzlich zeigte ein eigener Probelauf die Karte der Gruppe vor und nach der Änderung in sechs Fenstergrößen
(Chromium, Vorführung; Karte 288 bis 846 px breit), jeweils mit einem begonnenen Ort und mit allen vier Orten
geschafft (dann trägt jede Marke einen Stempel).

- **Vorher:** In jeder Größe verdeckte eine Ortsmarke den Namen Dresden; bei 745 bis 846 px Kartenbreite auch Meißen,
  Plauen und Bautzen. In der Größe des Rundgang-Videos (543 px) zusätzlich Freiberg und Hoyerswerda, Görlitz ragte
  über den Rand, die Bilder von Bastei und Frauenkirche überlappten, und das Schild „Frauenkirche Dresden“ lag über
  dem Bild von Bautzen. Mit allen Orten geschafft lag in jeder Größe der Stempel der Frauenkirche auf dem Bild der
  Bastei.
- **Nachher:** In allen sechs Größen ist kein Stadtname verdeckt (Dresden, Meißen, Plauen, Bautzen stehen unter einer
  Ortsmarke und sind ausgeblendet, Görlitz und Freiberg stehen je nach Größe links vom Punkt). In den fünf Größen ab
  543 px überlappt keine Marke eine andere, und kein Namensschild und kein Stempel liegt auf dem Bild einer anderen
  Marke.
- **Bleibt:** Auf dem Telefon (Karte 288 px, Ortsnamen dort ohnehin ausgeblendet) überlappen sich die drei östlichen
  Marken weiterhin, und der Stempel der Bastei liegt auf Bautzen (vorher drei Stempel auf fremden Marken); dort wählt
  man die Orte in der Liste unter der Karte.

Der Probelauf ist ein Werkzeug außerhalb des Repos; seine Ergebnisse stehen hier.

## Bilder und Rundgang

- `medien/1-karte.png` bis `medien/4-kompetenzraster.png` sind `browser/konzept/` in halber Größe (820 × 1180), ohne
  Metadaten (`4-kompetenzraster.png` ist bytegleich zum vorigen Stand).
- `medien/rundgang.mp4`, `medien/rundgang.gif` und `medien/poster.png`: der Rundgang aus Sicht einer Schülergruppe,
  neu aufgenommen am 16.11.2026 von 16:49 bis 16:52 Uhr in der Vorführung auf `5e1df13`, mit denselben sechs Szenen
  und Sätzen. Neu ist ein Abspann (drei Sekunden): „Selbst ausprobieren“, die Adresse, darunter „Panagiotis Herbe ·
  Code AGPL-3.0-only · Texte und Zeichnungen CC BY-SA 4.0 · Fotos: Wikimedia Commons, Urheber und Lizenz je Bild im
  Repository“. Szene 6 ist dafür 1,2 Sekunden kürzer. 70,4 Sekunden statt 68,0, ohne Ton; MP4 1280 × 800, 2.978.873
  Bytes; GIF 800 × 500, 3.254.212 Bytes; Poster = erstes Bild, ohne Metadaten. Der Spielstand in Szene 5 ist für den
  Rundgang vorbereitet, die Gruppen in Szene 6 sind simuliert; beides steht im Video.

## Nicht wiederholt

Lasttest, Betriebstest, Sicherung, Archiv und Nachbau: Sie berühren diese Änderungen nicht. Ihre Zahlen gelten aus dem
offiziellen Messlauf (`../2026-11-15-gesamt/`).

Wie dort sind Spielstand und Gruppen simuliert: Ein Skript setzt sie in der Vorführung ein, es gab keine echte Klasse.
