# Fehlerkatalog

Alle Fehler der Schnittstelle kommen als JSON `{ "fehler": "<Meldung>" }` mit passendem HTTP-Status; die
Oberfläche zeigt die Meldung im Klartext. Die Tabelle nennt Ursache, Meldung und Behandlung.

| Status | Lage | Meldung (Beispiel) | Behandlung |
|---|---|---|---|
| 400 | Eingabe ungültig (Feld fehlt, Format falsch, unbekannter Ort, falsches Bildformat) | „png muss ein PNG mit 2048 × 2048 Pixeln sein“ | Eingabe korrigieren; Geräte verwerfen den Eintrag (wird nicht endlos wiederholt) |
| 401 | nicht angemeldet, Sitzung abgelaufen, Schlüssel falsch, Token fehlt | „Bitte als Lehrkraft anmelden“ | neu anmelden |
| 404 | unbekannt oder nicht die eigene Lerngruppe/Quest/Gruppe; Code gibt es nicht | „Diesen Code gibt es nicht. Bitte noch einmal nachsehen.“ | Code prüfen |
| 405 | falsche Methode | „Methode nicht erlaubt“ | – |
| 409 | freie Gruppenbezeichnung ohne Bestätigung; Bezeichnung doppelt; Quest beendet; zu viele Gruppen | „Bitte keine Namen oder Namensteile …“ (mit `bestaetigen: true`) | Hinweis bestätigen oder Vorschlag wählen |
| 410 | Gruppe gelöscht (Frist oder Lehrkraft) | „Diese Gruppe gibt es nicht mehr …“ | Gerät tritt mit neuem Code bei |
| 413 | Anfrage zu groß | „Anfrage zu groß (höchstens 1 MB)“ | – |
| 415 | kein JSON | „Erwartet wird application/json“ | – |
| 429 | zu viele Fehlversuche (Codes, Schlüssel) oder zu viele Familienbilder | „Zu viele falsche Codes. Bitte eine Minute warten.“ | eine Minute warten |
| 500 | unerwarteter Fehler | „Interner Fehler“ | Protokoll (`docker compose logs`) enthält Routenklasse und Stapel, keine Personendaten |
| 0 (kein Netz) | Gerät offline | „Keine Verbindung. Die Daten bleiben im Gerät und werden später übertragen.“ | nichts tun; Übertragung läuft automatisch |

## Anmeldung (Weiterleitung mit `#fehler=…`)

| Kennung | Ursache | Meldung |
|---|---|---|
| `nicht-erreichbar` | Anmeldedienst antwortet nicht oder mit 5xx | „Der Anmeldedienst ist gerade nicht erreichbar. Bereits angemeldete Geräte und vorgeladene Quests laufen weiter …“ |
| `anbieter` | Anmeldedienst antwortet mit 4xx | „Die Anmeldung hat nicht geklappt.“ |
| `token` | Signatur, Aussteller, Empfänger, Ablauf oder `nonce` stimmen nicht | „Die Antwort des Anmeldedienstes ließ sich nicht prüfen …“ |
| `rolle` | Rollenmerkmal fehlt oder unbekannt | „Der Anmeldedienst hat keine Rolle „Lehrkraft“ übermittelt …“ |
| `merkmale` | `sub` fehlt | wie `token` |
| `vorgang` | Rückkehr ohne gültigen, an dieses Fenster gebundenen Vorgang (abgelaufen, doppelt, anderes Fenster) | „Die Anmeldung war abgelaufen oder wurde in einem anderen Fenster begonnen …“ |
| `kein-anmeldedienst` | Instanz ohne Anmeldedienst | „Für diese Instanz ist kein Anmeldedienst eingerichtet.“ |

## Im Gerät

| Lage | Verhalten |
|---|---|
| Spielmodul lädt nicht oder verletzt den Vertrag | „Dieses Spiel lässt sich gerade nicht laden.“ mit Rückweg zum Ort |
| Spiel wirft einen Fehler | „Hoppla, im Spiel ist ein Fehler passiert.“ mit „Noch einmal“ |
| Inhalte nicht im Gerät und kein Netz | „Inhalte nicht erreichbar. Bitte einmal mit Netz öffnen …“ |
| Speicher im Browser nicht verfügbar (privates Fenster) | Einstellungen gelten bis zum Schließen; Spielstand bleibt im Arbeitsspeicher |
| Kamera nicht freigegeben | „Die Kamera ließ sich nicht öffnen. Bitte den Code eintippen.“ |
| Standort ungenau oder nicht freigegeben | Hinweis auf QR-Code oder Code |
