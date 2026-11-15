# Sortieren und Zuordnen

**Kurz:** Karten in die richtige Reihenfolge bringen (`art: "reihenfolge"`, etwa eine Zeitleiste oder Arbeitsschritte) oder
Gruppen zuordnen (`art: "gruppen"`, etwa deutsche und sorbische Ortsnamen).

## Spielregeln

- **Reihenfolge:** Pfeil-Knöpfe „nach oben“/„nach unten“ an jeder Karte oder Ziehen am Griff. Die Karten stehen in der
  Aufgabe in der richtigen Reihenfolge; das Spiel mischt sie mit dem Startwert `mischen`. Ein `zusatz` (etwa die Jahreszahl)
  erscheint erst, wenn alles stimmt.
- **Gruppen:** Karte antippen, dann bei der passenden Gruppe „Hierher legen“. Karten lassen sich umlegen oder zurück in die
  Ablage legen.
- „Prüfen“ markiert jede Karte mit Haken („richtiger Platz“) oder Hinweis („noch nicht“), mit Wort und Symbol.
- Hat die Gruppe schon einmal geprüft, löst das Spiel beim letzten richtigen Zug von selbst.

## Tipps (drei Stufen)

1. eigener Hinweis aus der Aufgabe; 2. richtige Karten markieren; 3. eine Karte an ihren Platz legen (wiederholbar).

## Sammelstück und Sterne

- Wer fertig sortiert, bekommt **jedes** Sammelstück aus `belohnung`.
- Sterne: 3 ohne Tipp im ersten Versuch, 2 mit höchstens einem Tipp und höchstens drei Versuchen, sonst 1.

## Ereignisse

| Art | wann |
|---|---|
| `versuch` | `false` bei „Prüfen“, solange noch etwas falsch liegt; `true` beim Lösen |
| `neuer-anlauf` | erste Bewegung nach einem falschen „Prüfen“: `true`, wenn die Gruppe eine als falsch markierte Karte bewegt oder einen Tipp holt |
| `hilfe` | Tippstufe 1–3 |
| `rolle` | `steuern` (Karten bewegen, auswählen, ablegen), `pruefen`, `nachschlagen`, `vorlesen` |
