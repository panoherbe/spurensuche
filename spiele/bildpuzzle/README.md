# Bildpuzzle

**Kurz:** Ein Foto des Orts liegt gemischt in Teilen da. Die Gruppe tauscht immer zwei Teile, bis das Bild stimmt.

## Spielregeln

- Tippen: ein Teil antippen, dann ein zweites; die beiden tauschen die Plätze. Ziehen geht auch.
- Tastatur: Pfeiltasten wandern über die Teile, Leertaste oder Eingabe wählt und tauscht, Escape hebt die Wahl auf.
- Bildschirmleser: Jedes Teil sagt, was darauf zu sehen ist (`teile` in der Aufgabe) und wo es liegt.
- „Prüfen“ sagt, wie viele Teile schon richtig liegen. Sobald alle stimmen, ist das Bild fertig.
- Kein Zeitdruck. Das Tempo der Bewegungen folgt `umgebung.tempo`; bei reduzierter Bewegung springen die Teile.

## Tipps (drei Stufen)

1. Das ganze Foto wird gezeigt.
2. Teile, die richtig liegen, bekommen einen Haken.
3. Ulla legt ein Teil an seinen Platz (Ecken zuerst). Diese Stufe lässt sich wiederholen, so kommt jede Gruppe ans Ziel.

## Sammelstück und Sterne

- Wer das Bild fertig hat, bekommt **jedes** Sammelstück aus `belohnung`, unabhängig von Tipps und Versuchen.
- Sterne (`punkte`, nur als Rückmeldung im Spiel): 3 ohne Tipp und mit höchstens einem „Prüfen“ vor dem Ziel,
  2 mit höchstens einem Tipp und höchstens zwei „Prüfen“, sonst 1.

## Ereignisse

| Art | wann |
|---|---|
| `versuch` | `false` bei „Prüfen“, solange das Bild nicht stimmt; `true`, wenn das letzte Teil richtig liegt |
| `hilfe` | Tippstufe 1, 2 oder 3 |
| `neuer-anlauf` | erste Aktion nach einem falschen „Prüfen“: `true`, wenn die Gruppe ein falsch liegendes Teil bewegt oder einen Tipp holt; `false` bei erneutem „Prüfen“ ohne Änderung oder beim Tausch zweier richtiger Teile |
| `rolle` | `steuern` bei jedem Antippen oder Ziehen, `pruefen` bei „Prüfen“, `nachschlagen` bei „Tipp holen“, `vorlesen` bei „Vorlesen“ (nur wenn die Aufgabe Rollen nennt) |

## Felder der Aufgabe

Siehe [`schema.json`](schema.json): `bild` (Datei, Breite, Höhe, Alternativtext in beiden Sprachstufen, Quelle mit
Lizenz), `raster` (2–5 Spalten und Zeilen), `teile` (was jedes Teil zeigt, Reihe für Reihe von links oben), optional
`tipps` (eigene Texte der drei Stufen) und `wusstetIhr`.
