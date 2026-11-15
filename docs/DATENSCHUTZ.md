# Datenschutz: was gespeichert wird und was nicht

Kurz: Es gibt keine Datensätze über Kinder. Bezugspunkt aller Beobachtungen ist eine Gruppe mit neutraler
Bezeichnung („Biber“). Lehrkräfte stehen nur als Pseudonym in der Datenbank. Familien hinterlassen auf dem Server
nichts, außer einem Bild, das sie selbst freigeben. Gruppendaten löscht der Server nach festen Fristen; Zugänge von
Lehrkräften entfernt die Verwaltung, freigegebene Bilder bleiben ohne Bezug zur Gruppe für die Ausstellung. Dieses Dokument
beschreibt den Stand des Codes; die Tests in `test/` prüfen die wichtigsten Zusagen.

## Grundsätze im Code

| Zusage | Wo umgesetzt | Wie geprüft |
|---|---|---|
| Keine Tabelle und kein Feld für einzelne Lernende | `server/db.js` (Schema) | Durchsicht des Schemas; Test „Übertragung: bereinigt …“ |
| Nur Gruppenebene, Rollen sind Positionen | `app/js/kern/ereignisse.js` (erlaubte Ereignisse), `kern/raster.js` | Tests „Ereignisse: nur erlaubte Arten und Werte, kein Freitext“ |
| Kein Freitext, keine Koordinate, keine Gerätekennung in Beobachtungen | Bereinigung im Gerät **und** auf dem Server | Test prüft, dass „Lisa“ und „51.05“ nicht in der Datenbank landen |
| Außerhalb der Klassenstufen 4 bis 8 oder ohne bestätigte Einwilligung entstehen keine Datensätze | `server/app.js` (`erfassungFuer`, Route `/api/v1/sync`), `app/js/spielstand.js` (`inAusgang`) | Test „Außerhalb der Klassen 4 bis 8 oder ohne Einwilligung entstehen keine Datensätze“ |
| Familienmodus ohne Konto, nichts verlässt das Gerät außer einem freigegebenen Bild | `app/js/spielstand.js`, `app/js/seiten/bild.js` | Durchsicht; Familienbild ohne Freigabe wird abgelehnt (Test „Bildbeiträge …“) |
| Name und E-Mail des Anmeldedienstes nie gespeichert | `server/oidc.js` (nur `sub` und Rolle verlassen die Prüfung), `server/app.js` | Test durchsucht die Datenbankdatei samt WAL nach Name, E-Mail, `sub`, Schule |
| Löschfristen | `server/db.js` (`raeumeAuf`), `app/js/kern/zeit.js` | Test „Löschfristen und vorzeitige Löschung …“ |

## Was die Datenbank enthält

| Tabelle | Inhalt | Personenbezug | gelöscht |
|---|---|---|---|
| `lehrkraft` | HMAC-SHA256 aus Aussteller und Pseudonym des Anmeldedienstes (bzw. der Nummer des Zugangsschlüssels), Herkunft, erster und letzter Zugriff | pseudonym (Schlüssel des HMAC liegt nur in der Instanz) | mit dem Ende des Zugangs (manuell durch die Verwaltung) |
| `zugangsschluessel` | Bezeichnung (z. B. „Pilotschule 1, Lehrkraft 3“), SHA-256 des Schlüssels, gesperrt | keiner (Bezeichnung frei, ohne Namen zu verwenden) | durch die Verwaltung |
| `sitzung` | SHA-256 des Sitzungstokens, Rolle, Ablauf | keiner | mit Ablauf (12 h / 8 h / 2 h) |
| `lerngruppe` | Bezeichnung (z. B. „Klasse 6a“), Klassenstufe, Datum der Einwilligungsbestätigung | keiner | Ende des Schuljahres oder durch die Lehrkraft |
| `freigabe` | Titel, Zeitrahmen, Orte und Aufgaben, Erfassung an/aus | keiner | 12 Wochen nach Ende, spätestens Schuljahresende |
| `gruppe` | Bezeichnung, Beitrittscode, Einschätzung der Lehrkraft (Stufen) | nur über das Wissen der Lehrkraft, welche Kinder in welcher Gruppe sind | wie `freigabe` oder früher durch die Lehrkraft |
| `geraet` | SHA-256 des Gerätetokens einer Gruppe | keiner | mit der Gruppe |
| `station` | Ort, Stand, Art der Ortsprüfung (`qr`, `code`, `gps`, `ersatz`), Zeiten, aktive Sekunden | wie `gruppe` | mit der Gruppe |
| `lauf` | je Aufgabe: gelöst, Versuche, Dauer, Sammelstücke, bereinigte Ereignisse | wie `gruppe` | mit der Gruppe |
| `technik` | Zeitpunkte ohne Netz und der Übertragung | wie `gruppe` | mit der Gruppe |
| `rueckmeldung` | Antworten auf drei feste Fragen je Aufgabe (nur Workshops) | keiner | mit der Quest |
| `bildbeitrag` | PNG, Vorschau, Kennung, Zeitpunkt, Art, Sammelstücke, Stand der Freigabe | keiner (kein Name, keine Gruppe im Bild und in den Metadaten) | nicht freigegeben: mit der Gruppe; freigegeben: bleibt für die Ausstellung |
| `protokoll` | Zeit, Rolle, Aktion, Ziel-Kennung | keiner | nach einem Jahr |

## Was nie gespeichert wird

Namen von Kindern, Pseudonyme einzelner Kinder, Zuordnung von Kindern zu Gruppen, Fotos, Ton, Video, Freitext außer
Bezeichnungen, Standortkoordinaten (die GPS-Prüfung vergleicht im Gerät und verwirft die Position), Kamerabilder (die
QR-Erkennung läuft im Gerät), IP-Adressen (die Bremse gegen das Durchprobieren von Codes hält die Absenderadresse nur
für die laufende Minute im Arbeitsspeicher), Gerätekennungen, Name, E-Mail und sonstige Merkmale aus dem
Anmeldedienst.

## Im Gerät (Browser)

IndexedDB `spurensuche`: Einstellungen, Team bzw. Gruppe mit Spielstand und Sammelstücken, Ausgang der noch nicht
übertragenen Einträge, das eigene Bild. Der Service Worker hält App und Inhalte vor. Nichts davon wird bei
Abmeldung oder Sitzungsende gelöscht (für die Nutzung ohne Netz nötig); „Daten auf diesem Gerät löschen“ auf der
Seite Datenschutz entfernt alles außer den Einstellungen.

## Ereignisse, die eine Gruppe beschreiben

| Art | Bedeutung | Wert |
|---|---|---|
| `versuch` | eine abgegebene Lösung | richtig/falsch |
| `weg` | gewählter Lösungsweg | Kennung aus der Aufgabe |
| `hilfe` | Hinweis oder Nachschlagen | Stufe oder Kennung |
| `neuer-anlauf` | erstes Vorgehen nach einem Fehlversuch: gewechselt oder nicht | ja/nein |
| `rolle` | Eingabe auf einer Rollenposition | Kennung der Rolle |
| `abstimmung` | gemeinsame Entscheidung | einig/Mehrheit |
| (App) Station | Beginn, Ende, Stand, Art der Ortsprüfung, aktive Zeit | – |
| (App) Netz | Zeitpunkte ohne Netz und der Übertragung | – |

## Rechtsgrundlage und Rollen (Vorschlag für den Betrieb)

Die Schule bzw. Lehrkraft ist für die Gruppendaten verantwortlich; der Betrieb der Instanz ist
Auftragsverarbeitung (Art. 28 DSGVO). Bis zur Anbindung an den schulischen Anmeldedienst gilt die
Einwilligungslösung: Brief an die Erziehungsberechtigten (in der Anwendung unter „Einwilligungsbrief“), die
Lehrkraft bestätigt nur, dass die Einwilligungen vorliegen. Ohne Bestätigung entsteht kein Datensatz.
