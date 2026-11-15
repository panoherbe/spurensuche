# Betriebshandbuch für den Telefondienst

Kurz: Eine Seite zeigt, ob die Spurensuche läuft: die **Ampel**. Vier Knöpfe lösen fast jedes Problem:
**Neu starten**, **Sicherung zurückspielen**, **Inhalt tauschen**, **Letzte Version zurückspielen**. Jeder Knopf
sagt vorher, was passiert, und lässt sich zurücknehmen. Programmieren müssen Sie nichts.

Dieses Handbuch ist für Menschen ohne Entwicklerwissen geschrieben. Die technische Fassung für die Entwicklung
steht in [BETRIEB.md](BETRIEB.md).

## 1 Was Sie brauchen

| Was | Wofür |
|---|---|
| Adresse der Betriebsseite: `https://<adresse>/betrieb.html` | als Lesezeichen im Browser |
| Betriebsschlüssel (von der Entwicklung) | zum Anmelden auf der Betriebsseite. **Nie am Telefon nennen, nie per E-Mail schicken.** |
| Öffentliche Statusseite: `https://<adresse>/status.html` | Die Adresse dürfen Sie Anrufenden nennen: Dort sehen sie selbst, ob die Spurensuche läuft. |
| Zugang zum Server (von der Entwicklung) | nur für den Notfall in Abschnitt 8 |
| Kontakt der Entwicklung | steht auf der Betriebsseite unten unter „Hilfe“ |

Auf der Betriebsseite sehen Sie nur Technik. Lerngruppen, Ergebnisse von Schülerinnen und Schülern und Bilder
sehen Sie dort nicht, und Sie brauchen sie auch nicht.

## 2 Die Ampel lesen

Oben auf der Betriebsseite steht in einem farbigen Kasten:

| Anzeige | Bedeutung | Was Sie tun |
|---|---|---|
| ✓ **Alles in Ordnung** (grün) | Alles läuft. | nichts |
| ⚠ **Bitte ansehen: …** (gelb) | Etwas sollte bald erledigt werden; die Spurensuche läuft weiter. | Den genannten Punkt in der Liste suchen und die Zeile **„Was tun“** befolgen. |
| ✕ **Störung: …** (rot) | Etwas funktioniert nicht. | Sofort die Zeile **„Was tun“** befolgen. Hilft das nicht: Abschnitt 10. |

Darunter steht jeder Punkt einzeln: Anwendung, Datenbank, Sicherung, Speicherplatz, Fehler, Antwortzeit,
Arbeitsspeicher, Anmeldung über das Schulkonto, Inhalte, Betriebsdienst, Zertifikat. „Hinweis“ (blau) ist kein
Problem, nur eine Information. Die Seite prüft jede Minute von selbst; mit „Jetzt neu prüfen“ geht es sofort.

## 3 Der tägliche Blick (eine Minute, an Schultagen morgens)

1. Betriebsseite öffnen und mit dem Betriebsschlüssel anmelden.
2. Steht oben „Alles in Ordnung“: fertig.
3. Steht oben Gelb oder Rot: die Zeile „Was tun“ beim genannten Punkt befolgen.
4. Unter „Verlauf der letzten 24 Stunden“ sehen Sie, wie viel los war. Viele rote Striche bei „Fehler“: Abschnitt 10.

## 4 Knopf „Neu starten“

**Wann:** Die Anwendung ist langsam, meldet Fehler oder hängt; oder „Was tun“ sagt „Neu starten“.

1. Im Kasten **Neu starten** auf „Neu starten …“ klicken.
2. Die Frage mit „Jetzt neu starten“ bestätigen.
3. Warten. Die Seite meldet „Die Anwendung ist wieder erreichbar (nach … Sekunden)“. Das dauert meist nur wenige
   Sekunden (gemessen: gut eine Sekunde).
4. „Schließen“ klicken und die Ampel ansehen.

Es geht nichts verloren: Die Geräte der Gruppen speichern ihre Ergebnisse und übertragen sie danach von selbst.

## 5 Knopf „Sicherung zurückspielen“

**Wann:** Die Ampel zeigt „Datenbank“ rot, oder die Entwicklung bittet Sie darum.
**Nicht**, wenn nur eine einzelne Lehrkraft etwas gelöscht hat: Ein Zurückspielen setzt die Daten **aller**
Schulen zurück. Dann bitte die Entwicklung fragen.

Jede Nacht um 2 Uhr entsteht eine verschlüsselte Sicherung. Mit „Sicherung jetzt anlegen“ machen Sie zusätzlich
eine von Hand.

1. Im Kasten **Sicherung zurückspielen** bei „Welcher Stand?“ die Sicherung wählen (meist die oberste: die neueste).
2. „Zurückspielen …“ klicken.
3. Lesen: Alles, was nach diesem Stand eingegeben wurde, ist danach nicht mehr da.
4. Das Häkchen „Verstanden“ setzen und „Zurückspielen“ klicken.
5. Warten, bis die Seite meldet: „Der Stand vom … ist zurückgespielt“ (gemessen: wenige Sekunden; bei sehr vielen
   Daten bis etwa eine Minute).

**Zurück:** Vor dem Zurückspielen sichert die Anwendung den jetzigen Stand. In der Liste heißt diese Sicherung
„vor dem Zurückspielen“. Wählen Sie sie, kommt alles wieder wie vorher.

## 6 Knopf „Inhalt tauschen“

**Wann:** Das Redaktionsteam schickt neue Inhalte (Orte, Aufgaben, Bilder) als ZIP-Datei, zum Beispiel
„Inhalt März 2027.zip“.

1. Im Kasten **Inhalt tauschen** bei „Inhaltspaket (ZIP-Datei)“ die Datei auswählen.
2. „Prüfen“ klicken. Die Anwendung prüft jede Datei. Dabei ändert sich noch nichts.
3. Steht da **„Geprüft, keine Fehler“**: die Liste der Orte ansehen, dann „Jetzt aktivieren …“ und „Aktivieren“.
   Steht da ein Hinweis zu laufenden Quests: lieber am Abend aktivieren, wenn die Quests beendet sind.
4. Steht da **„Nicht übernommen“**: Es wurde nichts verändert. Die Fehlerliste (Bildschirmfoto) an das
   Redaktionsteam schicken.

Die Geräte holen den neuen Inhalt, wenn die App das nächste Mal mit Internet geöffnet wird.

**Zurück:** „Vorherigen Inhalt wiederherstellen“. Gibt es Probleme mit einem Paket, hilft immer
„Mitgelieferten Inhalt verwenden“ (der Inhalt, der mit der Anwendung kam).

## 7 Knopf „Letzte Version zurückspielen“

**Wann:** Nach einer neuen Version der Anwendung stimmt etwas nicht (die Entwicklung kündigt neue Versionen an).

1. Im Kasten **Letzte Version zurückspielen** steht: „Installiert: Version …, davor: …“.
2. „Letzte Version zurückspielen …“ klicken und mit „Zurückspielen“ bestätigen.
3. Warten, bis „Erledigt“ erscheint (gemessen: etwa eine halbe Minute). Daten, Inhalte und Anmeldungen bleiben
   erhalten.
4. Die Entwicklung informieren, damit sie den Fehler in der neuen Version behebt.

Ist der Knopf grau, steht darunter der Grund. Meist meldet sich der Betriebsdienst am Server nicht: Abschnitt 8.

Startet eine neue Version gar nicht, kehrt der Server nach etwa zwei Minuten von selbst zur vorherigen Version
zurück; dafür müssen Sie nichts tun. Hängt die Anwendung, startet der Betriebsdienst sie nach etwa zwei Minuten von
selbst neu.

## 8 Wenn die Betriebsseite nicht lädt

1. Die Statusseite `https://<adresse>/status.html` öffnen.
   - Sie lädt und zeigt eine Meldung: Das ist der Zustand. Weiter mit Schritt 2, wenn er rot ist.
   - Sie lädt auch nicht: Vielleicht ist Ihr eigenes Internet weg. Mit dem Telefon (ohne WLAN) prüfen.
2. Am Server anmelden (so, wie es Ihnen die Entwicklung eingerichtet hat), dann eintippen:
   ```
   cd /srv/spurensuche
   betrieb/spur
   ```
3. Es erscheint ein Menü mit Zahlen. Zahl eintippen, Eingabetaste:
   - **1** Zustand anzeigen: zeigt, ob die Anwendung antwortet, die Ampel und die neuesten Sicherungen.
   - **2** Neu starten (wie Abschnitt 4).
   - **4** Sicherung zurückspielen: Nummer aus der Liste wählen, dann `ja` eintippen.
   - **5** Letzte Version zurückspielen: `ja` eintippen.
   - **0** Beenden.
4. Steht da „FEHLER“: den Text abschreiben oder fotografieren und die Entwicklung informieren.

## 9 Typische Anrufe

| Anruf | Was Sie fragen oder sagen |
|---|---|
| „Die Spurensuche geht nicht.“ | Statusseite nennen. Zeigt sie „läuft“: Seite auf dem Gerät neu laden; anderes Gerät probieren. Die App funktioniert auch ohne Internet weiter; Ergebnisse werden später übertragen. |
| „Der Code unserer Gruppe geht nicht.“ | Code genau vorlesen lassen. Groß- und Kleinschreibung ist egal; die Codes enthalten keine Null und kein O, keine Eins und kein I. Die Lehrkraft sieht alle Codes ihrer Quest in der Ansicht für Lehrkräfte. |
| „Ergebnisse einer Gruppe fehlen.“ | Die Gruppe soll die App auf ihrem Gerät einmal mit Internet öffnen. Bis dahin liegen die Ergebnisse sicher im Gerät. Die Lehrkraft sieht „Zuletzt übertragen“ bei jeder Gruppe. |
| „Ich komme als Lehrkraft nicht rein.“ | Ampel „Anmeldung über das Schulkonto“ ansehen. Gestört: Die Lehrkraft kann sich mit einem Zugangsschlüssel anmelden; den vergibt die Verwaltung (nicht der Telefondienst). |
| „Unser Bild ist nicht in der Ausstellung.“ | Bilder von Schulgruppen erscheinen erst, wenn die Lehrkraft sie freigibt (Ansicht für Lehrkräfte, „Bildbeiträge“). Familien geben ihr Bild beim Hochladen selbst frei. |
| „Wir sehen noch die alten Orte.“ | Die App einmal mit Internet öffnen und neu laden. Neue Inhalte kommen beim nächsten Öffnen mit Netz. |
| „Bitte löschen Sie unsere Daten.“ | Lehrkräfte löschen Lerngruppen und Quests selbst in ihrer Ansicht. Alles andere löscht die Anwendung nach festen Fristen von selbst. Sie löschen nichts auf Zuruf; bei Fragen: Entwicklung. |

## 10 Wann Sie die Entwicklung informieren

- Die Ampel bleibt rot, auch nach „Neu starten“.
- Sie haben eine Sicherung oder eine Version zurückgespielt (damit die Ursache behoben wird).
- „Speicherplatz“ oder „Zertifikat“ ist gelb oder rot.
- Ihnen kommt etwas merkwürdig vor, zum Beispiel jemand fragt nach Schlüsseln oder Daten.

**Sagen Sie dazu:** Uhrzeit, welcher Punkt der Ampel welche Farbe hat, den Text bei „Was tun“, was Sie schon
gedrückt haben. Am besten ein Bildschirmfoto der Betriebsseite.

**Was Sie nie tun:** Schlüssel weitergeben, Daten an Anrufende herausgeben, die Einstellungsdatei auf dem Server
ändern, auf Zuruf eine Sicherung zurückspielen.

## 11 Wörter kurz erklärt

| Wort | Bedeutung |
|---|---|
| Ampel | Zusammenfassung oben auf der Betriebsseite: grün, gelb oder rot |
| Sicherung | verschlüsselte Kopie aller Daten; jede Nacht eine, dazu die von Hand angelegten |
| Inhaltspaket | ZIP-Datei mit Orten, Aufgaben und Bildern; enthält nie Programmcode |
| Version | Stand der Anwendung selbst (des Programms); neue Versionen spielt die Entwicklung ein |
| Betriebsdienst | kleines Programm auf dem Server; wechselt auf Knopfdruck die Version und startet die Anwendung neu, wenn sie hängt |
| Statusseite | öffentliche Seite ohne Anmeldung: Läuft die Spurensuche? |
| Container | abgeschlossene Umgebung auf dem Server, in der die Anwendung läuft |

Die Zeiten in diesem Handbuch sind gemessen: Betriebstest im Ordner `nachweis/` (Datei `betriebstest.json`).
