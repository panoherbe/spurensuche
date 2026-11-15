# Auswertung für Lehrkräfte: Regeln

Kurz: Die Auswertung beschreibt, was eine Gruppe beim Spielen getan hat, und ordnet es im Kompetenzraster ein. Sie
schlägt eine Stufe vor; die Einschätzung trifft die Lehrkraft. Es gibt keine Note, keine Punktzahl, keinen
Prozentwert als Gesamturteil und keine Rangfolge zwischen Gruppen. Alle Regeln stehen in `app/js/kern/raster.js`
und hier; dieselbe Datei läuft auf dem Server und in der Vorführung.

## Bereiche und Stufen

Bereiche: **Teamleistung**, **Problemlösung**, **Beteiligung**. Stufen nach der Stufenfolge der sächsischen
Lehrpläne: Einblick gewinnen, Kennen, Anwenden, Beurteilen / Sich positionieren, Gestalten. Jede Aufgabe trägt die
Stufe, die sie anspricht (`stufe` in der Aufgabendatei).

## Wann eine Zelle als „beobachtet“ gilt

| Bereich | Stufe | Beleg, wenn … |
|---|---|---|
| Teamleistung | Einblick gewinnen | eine Station begonnen ist |
| | Kennen | eine Aufgabe gelöst bzw. entschieden ist |
| | Anwenden | eine Station vollständig abgeschlossen ist |
| | Beurteilen / Sich positionieren | eine Aufgabe der Stufe „Beurteilen“ abgeschlossen ist |
| | Gestalten | eine Aufgabe der Stufe „Gestalten“ abgeschlossen oder der Bildbeitrag gestaltet ist |
| Problemlösung | Einblick gewinnen | in einer Aufgabe Lösungen ausprobiert wurden |
| | Kennen | eine Aufgabe ab Stufe „Kennen“ gelöst ist |
| | Anwenden | eine Aufgabe ab Stufe „Anwenden“ im ersten Versuch gelöst ist **oder** nach einem Fehlversuch mit gewechseltem Vorgehen |
| | Beurteilen / Sich positionieren | in einer gelösten Aufgabe ab Stufe „Beurteilen“ mindestens zwei Lösungswege gewählt wurden |
| | Gestalten | eine Aufgabe der Stufe „Gestalten“ mit höchstens einer Hilfe gelöst ist |
| Beteiligung | Einblick gewinnen | eine Rolle Eingaben gemacht hat |
| | Kennen | in einer Aufgabe mindestens zwei Rollen Eingaben gemacht haben |
| | Anwenden | in einer Aufgabe alle vorgesehenen Rollen (mindestens zwei) Eingaben gemacht haben |
| | Beurteilen / Sich positionieren | die Gruppe eine Abstimmung genutzt hat |
| | Gestalten | mindestens zwei Abstimmungen, davon mindestens die Hälfte einig |

**Vorschlag** je Bereich ist die höchste Stufe mit mindestens einem Beleg. Jede beobachtete Zelle nennt ihre Belege
(„Station „Bastei“ vollständig abgeschlossen“). Wählt die Lehrkraft eine Stufe, gilt diese im Raster, im Bericht und
im Formulierungsentwurf.

## Beobachtungen (beschreibend)

- Teamleistung: Stationen abgeschlossen, abgebrochen, in Arbeit; Aufgaben gelöst bzw. bearbeitet; vor Ort oder
  ortsunabhängig gespielt; Bildbeitrag gestaltet.
- Problemlösung: Aufgaben im ersten Versuch gelöst; Aufgaben mit Fehlversuchen; Wechsel des Vorgehens nach einem
  Fehlversuch (wie oft gewechselt, wie oft dasselbe noch einmal); genutzte Hilfen mit Zeitpunkt; gewählte Wege.
- Beteiligung: Eingaben je Rollenposition; Abstimmungen (einig, mit Mehrheit).
- Zeit und Technik: aktive Bearbeitungszeit; Phasen ohne Netz und Zeitpunkt der Übertragung.

## Formulierungsentwurf

Je Bereich ein Satz zur gewählten oder vorgeschlagenen Stufe in der Vergangenheit und ein möglicher nächster
Schritt. Der Text beginnt mit „Entwurf – Grundlage: …“, ist vor dem Export frei bearbeitbar und wird nicht
gespeichert; er geht nur in den Gruppenbericht, den die Lehrkraft herunterlädt.

## Gruppenbericht (PDF)

Gruppe, Quest, Datum der Beobachtungen und des Berichts, Hinweis „keine Bewertung“, je Bereich Stufe mit Beschreibung
und Belegen, die Beobachtungen, der bearbeitete Entwurf, der Löschtermin. Erzeugt im Browser; er verlässt das Gerät
nur, wenn die Lehrkraft ihn speichert.

## Grenzen

- Die Regeln sind ein Vorschlag für die Erprobung; Indikatoren und Schwellen werden mit Lehrkräften abgestimmt.
- Ein Spiel liefert nur die Ereignisse, die zu seiner Mechanik passen; Belege fehlen also dort, wo ein Format eine
  Handlung nicht vorsieht (z. B. ohne Rollen keine Belege zur Beteiligung).
