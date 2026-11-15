# Architektur

Kurz: Eine Progressive Web App für Geräte der Gruppen und für Lehrkräfte, ein kleiner Server mit SQLite, beides ohne
Fremdbibliotheken. Inhalte sind Dateien (JSON, Bilder, Spielmodule), die das Gerät vollständig vorlädt. Die Regeln für
Datenschutz und Auswertung liegen in gemeinsamen Modulen, die Gerät, Server und Vorführung gleich nutzen.

```mermaid
flowchart LR
  subgraph Gerät der Gruppe (Browser)
    A[App: Karte, Orte, Aufgaben, Sammelbuch, Bild] --> S[(IndexedDB: Spielstand, Ausgang, Bild)]
    A --> W[Service Worker: App und Inhalte offline]
    A --> M[Spielmodule spiele/&lt;format&gt;]
  end
  subgraph Lehrkraft (Browser)
    L[Lerngruppen, Quests, Gruppen, Übersicht, Auswertung, Bericht, Bildfreigabe]
  end
  subgraph Betrieb (Browser)
    B[Betriebsseite: Ampel, Verlauf, Neustart, Sicherung, Inhalt, Version]
  end
  subgraph Server (Container, Node.js 24)
    R[/api/v1 REST/] --> D[(SQLite)]
    R --> I[Inhalte: inhalte/, spiele/, assets/spiele/]
    Z[Sicherung täglich, AES-256-GCM] --> D
  end
  subgraph Server (Host)
    G[Betriebsdienst betrieb/spur wache: Versionen, Neustart bei Hänger]
  end
  A -- Beitritt, Übertragung (wiederholungssicher) --> R
  L -- Sitzung --> R
  B -- Sitzung Betrieb --> R
  G -- 127.0.0.1, Bearer-Token: Stand melden, Aufträge holen --> R
  X[Ausstellungssystem] -- Bearer-Token: freigegebene Bildbeiträge --> R
  O[Anmeldedienst OIDC] -. Code + PKCE .- R
```

## Bausteine

| Ordner | Inhalt |
|---|---|
| `app/` | Seiten (`index.html` Spieler, `lehrkraefte.html`, `verwaltung.html`, `betrieb.html`, `status.html`, `werkstatt.html`), Stile (`css/`), Skripte (`js/`), Service Worker, Manifest |
| `app/js/kern/` | gemeinsame Regeln ohne Browser- oder Server-Bezug: Schema-Prüfung, Ereignisse, Kompetenzraster, Löschfristen, Bezeichnungen, PDF, ZIP, QR |
| `app/js/seiten/` | Seiten der Spieler-Ansicht |
| `app/js/vorfuehrung.js` | Nachbildung der Schnittstelle im Browser für die statische Vorführung |
| `server/` | HTTP-Server (`app.js`), Datenbank (`db.js`), Anmeldung (`oidc.js`, `attrappe.js`), Inhalte (`inhalte.js`, `inhaltspaket.js`), Archiv (`archiv.js`), Sicherung (`sicherung.js`), Betrieb mit Ampel und Knöpfen (`betrieb.js`) |
| `betrieb/` | Werkzeug `spur` am Server (Menü, Neustart, Sicherung, Versionen, Betriebsdienst) und der systemd-Dienst |
| `spiele/`, `inhalte/`, `assets/spiele/` | Spielformate und Inhalte (Austauschformat: `docs/SCHNITTSTELLE.md`) |
| `tools/` | Werkzeuge: Inhalte prüfen, Inhaltspaket bauen, Karte bauen, Vorführung bauen, Sicherung, Rückspielen, OpenAPI erzeugen, Messlauf, Betriebstest |
| `test/` | Tests (`node --test`), Browser-Prüfläufe (`e2e/`), Lasttest (`last.js`) |

## Datenfluss einer Schulgruppe

1. Lehrkraft gibt eine Quest für eine Lerngruppe frei und legt Gruppen an; jede Gruppe hat einen Code.
2. Das Gerät tritt mit dem Code bei und bekommt ein Gerätetoken; der Service Worker hat App und Inhalte vorgeladen.
3. Beim Spielen entstehen Einträge im Ausgang (Station begonnen, Aufgabe beendet, Netzwechsel) mit eigenem
   Schlüssel. Mit Netz werden sie übertragen; ohne Netz warten sie. Der Server zählt jeden Eintrag und jeden Lauf
   nur einmal.
4. Die Lehrkraft sieht die laufende Übersicht und nach dem Spiel die Auswertung; Bildbeiträge gibt sie frei.
5. Nach der Frist löscht der Server die Gruppendaten; freigegebene Bilder bleiben ohne Gruppenbezug.

## Entscheidungen

| Entscheidung | Grund |
|---|---|
| PWA statt nativer App | ein Code für iPad, Android, Windows, ChromeOS; offline über Service Worker; kein App-Store; Betrieb ohne den Auftragnehmer |
| keine Fremdbibliotheken | geringer Wartungsaufwand im Betrieb, keine Lieferkettenrisiken, keine Lizenzfragen |
| SQLite | eine Datei, leicht zu sichern und zu übergeben; Austausch gegen PostgreSQL auf `server/db.js` und `server/app.js` begrenzt |
| Regeln in `app/js/kern/` | Gerät, Server und Vorführung wenden dieselben Regeln an; getestet an einer Stelle |
| Inhalte als Dateien | versionierbar, prüfbar (`tools/pruefe-inhalte.js`), offline vorzuladen, als offene Bildungsmaterialien weiterzugeben |
| eigene Karte aus offenen Daten | keine Kachel-Server, offline, keine Nutzungsbedingungen Dritter, gemeinfrei |
| Bildbeitrag als Item-Collage im Gerät | ohne generative KI, regelbasiert, ohne Personenbezug; der Server prüft Format und Größe |
| Betrieb mit wenigen sicheren Knöpfen | Telefondienst ohne Entwicklerwissen: jede Aktion erklärt sich, prüft vorher und ist umkehrbar; die Anwendung hat keinen Zugriff auf Docker, Versionen wechselt nur der Betriebsdienst am Server mit fest eingebauten Aktionen |
| Inhaltspakete ohne Programmcode | Redaktion und Betrieb tauschen Inhalte ohne Entwicklung; Code (Spiele) kommt nur mit geprüften Versionen auf die Geräte der Kinder |

## Grenzen dieses Prototyps

- QR-Erkennung in der App nutzt die eingebaute Erkennung des Browsers (Chrome, Edge, Android, ChromeOS). Auf iPad und
  in Firefox scannt die Kamera-App den Code oder die Gruppe tippt den Code vom Schild ein.
- Die Anmeldung ist gegen eine Attrappe getestet; die Integrationsspezifikation des schulischen Anmeldedienstes wird
  im Auftrag eingearbeitet.
- Ein Gerät je Gruppe ist der vorgesehene Fall; mehrere Geräte einer Gruppe übertragen zusammen, sehen aber jeweils
  nur den eigenen Spielstand.
