# Konzeptbilder 1 und 3, Nachlauf vom 15.11.2026

Im offiziellen Messlauf (`../2026-11-15-gesamt/`, Code-Stand `33ee143`, heute `57e4222`, Tag
`messlauf-2026-11-15`) endete der Bildschritt mit Rückgabe 1. Bild 2, 4 und 5 entstanden, Bild 1 (Karte) und Bild 3 (Collage) nicht. Der Grund lag im
Bildskript, nicht in der App: Es lud die Seite neu, während noch die Adresse des Beitritts bzw. der zuletzt gezeigten
Aufgabe galt (`browser/konzeptbilder.json` dort).

Nachlauf am 15.11.2026 um 15:36 Uhr auf demselben Rechner, im selben Container-Aufbau (`compose.test.yaml`):

- Stand `8802066`: App-Code wie `57e4222`, geändert ist nur `test/e2e/konzeptbilder.js`. Das Skript geht vor dem
  Neuladen zur Karte und setzt den simulierten Spielstand erst ein, wenn die Aufgabe verlassen ist.
- Ergebnis: alle vier Bilder entstanden, ohne Fehler (`konzeptbilder.json`, Liste `fehler` leer).
- `konzept/1-karte.png` und `konzept/3-collage-regler.png` liegen hier. Bild 2 und 4 kamen byte-gleich zum offiziellen
  Lauf heraus und liegen nur dort, ebenso Bild 5 (Betriebsseite). SHA-256 von Bild 2: `d91134e0dff80c573ef34cdd2ba2a3f1f7bd0424947861d4ded0273cd9d2e7a6`,
  von Bild 4: `1fb4a9ded2c3a9aa71f62c64fba2fb8d0e0db0f3c317782b2eaa7fe0e806a1a5` (in beiden Läufen gleich).

Wie im offiziellen Lauf sind Spielstand und Gruppen simuliert: Ein Skript setzt sie in der Vorführung ein, es gab keine
echte Klasse. Die Bilder sind im Format iPad hochkant aufgenommen, 820 × 1180 CSS-Pixel bei doppelter Auflösung
(1640 × 2360 px).
