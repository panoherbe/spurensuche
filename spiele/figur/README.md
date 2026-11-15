# Spielfigur

**Kurz:** Jede Gruppe gestaltet ihre eigene Figur: Hautfarbe, Frisur, Haarfarbe, Gesicht, Brille, Kopfbedeckung,
Oberteil, Hose, etwas in der Hand, Rucksack und ein Begleiter. 58 Teile, alle als eigene Vektorzeichnungen
(`teile.js`, CC BY-SA 4.0), Katalog in `inhalte/figur.json`.

- `figurSvg(auswahl, katalog)` liefert die Figur als SVG; `figurText` beschreibt sie in Worten (Alternativtext).
- `starteGestaltung(wurzel, { katalog, items, freigeschaltet, auswahl, umgebung })` zeigt den Baukasten und liefert
  die neue Auswahl. Alles per Tastatur: Jede Teilegruppe ist eine Gruppe von Optionsfeldern (Pfeiltasten).
- **Freischalten, transparent und nie zufällig:** Teile mit `freiDurch` werden frei, sobald die Gruppe das genannte
  Sammelstück hat. Bis dahin sind sie sichtbar, aber gesperrt, mit dem Hinweis, wofür es sie gibt (Kletterhelm mit dem
  Abzeichen Bastei, Lokführermütze mit dem Abzeichen Göltzschtal, Papierkrone mit dem Abzeichen Frauenkirche,
  Fernrohr mit dem Abzeichen Bautzen, Uhu-Küken mit dem Felsturm).
- Die Figur trägt keinen Namen und keine Daten über Personen; sie gehört der Gruppe.
