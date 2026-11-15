# Spurensuche im Bild

**Kurz:** Auf einem Foto des Orts stecken zwei bis sechs Details. Die Gruppe findet sie in beliebiger Reihenfolge und erfährt
zu jedem etwas.

## Spielregeln

- Antippen genügt: Das Spiel prüft die Stelle gegen die Bereiche der Ziele (`bereiche`, relativ 0–1, mit kleiner Toleranz).
- Tastatur: Ein Suchrahmen wandert mit den Pfeiltasten über ein Raster (`raster`), Eingabe sucht im Feld. Für
  Bildschirmleser beschreibt jedes Feld, was darin zu sehen ist (`felder`, Reihe für Reihe).
- Vergrößern mit „Größer“ und „Kleiner“ (100–300 %); das Bild lässt sich dann verschieben.
- Fehlklicks sind erlaubt und kosten nichts außer einem Hinweis.

## Tipps (je Detail, drei Stufen)

1. Hinweis aus der Aufgabe (`tipp` des Ziels); 2. ein heller Rahmen um den Bereich, dazu die Lage in Worten
   („oben in der Mitte“); 3. ein leuchtender Kreis genau an der Stelle. Nach jedem Fund beginnen die Tipps neu.

## Sammelstück und Sterne

- Wer alle Details findet, bekommt **jedes** Sammelstück aus `belohnung`.
- Sterne: 3 ohne Tipp und mit höchstens zwei Fehlklicks, 2 mit höchstens einem Tipp und höchstens sechs Fehlklicks, sonst 1.

## Ereignisse

| Art | wann |
|---|---|
| `versuch` | jeder Suchklick: `true` bei einem Fund, `false` daneben |
| `neuer-anlauf` | erster Klick nach einem Fehlklick: `true`, wenn er deutlich woanders liegt (mehr als ein Fünftel des Bildes) oder ein Tipp geholt wird |
| `hilfe` | Tippstufe 1–3 |
| `rolle` | `steuern` (suchen, vergrößern), `nachschlagen`, `vorlesen` |
