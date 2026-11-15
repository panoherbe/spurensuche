# Schätzfrage

**Kurz:** Die Gruppe schätzt eine Zahl zum Ort, einigt sich auf einen Wert und sieht die Auflösung mit einem Vergleich zum Anfassen.

## Spielregeln

- Zuerst wählt die Gruppe ihren Weg: **Schätzrunde** (jede und jeder tippt eine Zahl ein, ohne Namen; danach zeigt das Spiel
  die Spanne und die Mitte) oder **gleich gemeinsam**.
- Die gemeinsame Zahl stellt die Gruppe mit Regler, Zahlenfeld oder „weniger“/„mehr“ ein. Bei sehr großen Zahlen
  (`skala: "log"`) läuft der Regler in Zehnerschritten (1.000, 10.000, 100.000 …).
- Abgeben mit **„Alle sind einverstanden“** oder **„Die Mehrheit ist dafür“**.
- Liegt der erste Wert weit daneben, sagt das Spiel die Richtung („zu hoch“, „zu niedrig“), und die Gruppe schätzt noch
  einmal. Danach kommt immer die Auflösung: Balken für eure Schätzung und den echten Wert, ein Vergleich und eine Erklärung.
- Kein Zeitdruck; Bewegungen folgen `umgebung.tempo`.

## Tipps

Bis zu drei Texte aus der Aufgabe (`tipps`), etwa ein Maßstab („ein Stockwerk ist etwa 3 Meter hoch“), dann Grenzen.

## Sammelstück und Sterne

- Jede Gruppe, die abgibt, bekommt **jedes** Sammelstück aus `belohnung`: Mut zum Schätzen zählt.
- Sterne (`punkte`, nur Rückmeldung im Spiel) nach Nähe: `toleranz.drei`, `toleranz.zwei` (Prozent bei `linear`,
  Faktor bei `log`), sonst 1 Stern. Innerhalb von `toleranz.eins` gilt eine Schätzung als getroffen (`versuch: true`).

## Ereignisse

| Art | wann |
|---|---|
| `weg` | `schaetzrunde` oder `gemeinsam` |
| `abstimmung` | `einig` oder `mehrheit` bei jeder Abgabe |
| `versuch` | `true`, wenn die Schätzung innerhalb von `toleranz.eins` liegt, sonst `false` |
| `neuer-anlauf` | erste Änderung nach einer zu weit entfernten Schätzung: `true`, wenn die neue Zahl näher am echten Wert liegt (oder ein Tipp geholt wird), `false` bei erneuter Abgabe ohne Änderung oder in die falsche Richtung |
| `hilfe` | Tippstufe 1–3 |
| `rolle` | `steuern` bei Eingaben, `pruefen` bei der Abgabe, `nachschlagen` bei Tipps, `vorlesen` beim Vorlesen |
