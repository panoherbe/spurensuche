# Spiele der Spurensuche

**Kurz:** Fünf Minispiel-Formate, die sich mit beliebigen Inhalten wiederverwenden lassen, dazu Item-Collage und
Spielfigur. Alles sind ES-Module ohne Build-Schritt und ohne Laufzeit-Abhängigkeiten nach
[`docs/SCHNITTSTELLE.md`](../docs/SCHNITTSTELLE.md) (Version 1).

| Format | Ordner | Spielidee | Dauer |
|---|---|---|---|
| Bildpuzzle | [`bildpuzzle/`](bildpuzzle/README.md) | Foto des Orts aus Teilen zusammensetzen (Tippen, Ziehen, Tastatur) | 5–10 min |
| Schätzfrage | [`schaetzen/`](schaetzen/README.md) | Schätzrunde ohne Namen oder gemeinsam, Regler linear oder in Zehnerschritten, Auflösung mit Vergleich | 5–10 min |
| Dilemma | [`dilemma/`](dilemma/README.md) | Meinungen hören, abstimmen, begründen, Gegenseite ernst nehmen, Folgen und Wirklichkeit | 6–10 min |
| Sortieren und Zuordnen | [`sortieren/`](sortieren/README.md) | Zeitleiste, Arbeitsschritte oder Gruppen (z. B. deutsche und sorbische Ortsnamen) | 5–10 min |
| Spurensuche im Bild | [`bildsuche/`](bildsuche/README.md) | Details auf einem Foto finden; Raster mit Beschreibungen für Tastatur und Bildschirmleser | 5–10 min |
| Item-Collage | [`collage/`](collage/README.md) | Bildbeitrag aus den Sammelstücken: PNG 2048 × 2048, Vorschau, Metadaten | – |
| Spielfigur | [`figur/`](figur/README.md) | Charakteranpassung mit 58 Teilen; Teile werden durch Sammelstücke frei | – |

## Was alle Formate gemeinsam haben (`_gemeinsam/`)

- **Startkarte:** Titel, Auftrag, Rollen der Gruppe (Vorlesen, Steuern, Nachschlagen, Prüfen: Positionen, nie Personen)
  und das Sammelstück, das es zu gewinnen gibt. Belohnungen sind vorher sichtbar und nie zufällig.
- **Spielfläche:** Auftrag mit `data-vorlesen`, eigener Vorlese-Knopf, Tipps in drei Stufen mit Ulla Uhu, Rückmeldung in
  einem Element mit `role="status"` (immer Wort und Symbol, nie nur Farbe).
- **Abschlusskarte:** Sterne (nur Rückmeldung im Spiel, gehen nicht ins Dashboard), Sammelstück, „Wusstet ihr?“.
- **Barrierefrei:** alles per Tastatur, sichtbarer Fokus, Bedienflächen ab 48 × 48 px, kein Zeitdruck, Tempo 0,5–1,5,
  reduzierte Bewegung, einfache Sprache, Farben nur aus den Variablen der App (hell, dunkel, kontrastreich).
- **Sicher:** Texte nur über `textContent`, keine `innerHTML`, kein `eval`, Stil per `<link>` (strenge CSP).
- **Ereignisse** nur nach Schnittstelle 2.5: `versuch`, `weg`, `hilfe`, `neuer-anlauf`, `rolle`, `abstimmung`; `zeit` in
  Millisekunden seit `starte`. Welche Aktion welches Ereignis auslöst, steht in der README jedes Formats.

## Prüfen

```bash
# Logik und Inhalte (Node 24, im Container ohne Netz)
docker run --rm --network none -v "$PWD":/repo:ro -w /repo/spiele node:24-alpine node --test '_test/*.test.js'

# Messlauf: Playwright mit axe-core, jede Aufgabe nur mit der Tastatur gelöst, Bilder, Collage, Figur
REPO="$PWD" AUS=/tmp/messung AXE=/pfad/zu/axe.min.js sh spiele/_pruefung/laufen.sh --umfang voll
```

Testseiten: `spiele/_vorschau/index.html` (alle Aufgaben), `spiel.html?a=<ort>/<nr>` (ein Spiel mit Einstellungen
Sprache, Tempo, Kontrast, Bewegung, dunkel), `collage.html`, `figur.html`. Ergebnisse der Messungen mit Datum in
[`_nachweis/`](_nachweis/).

## Inhalte und Lizenzen

Aufgaben und Orte in [`../inhalte/`](../inhalte/), Bilder in [`../assets/spiele/`](../assets/spiele/). Eigene Texte,
Zeichnungen (Sammelstücke, Figur, Ulla Uhu) und Aufgaben: CC BY-SA 4.0. Fotos aus Wikimedia Commons unter freien
Lizenzen: [`../inhalte/BILDNACHWEIS.md`](../inhalte/BILDNACHWEIS.md). Schrift Atkinson Hyperlegible Next: SIL OFL 1.1.
Code: AGPL-3.0-only.
