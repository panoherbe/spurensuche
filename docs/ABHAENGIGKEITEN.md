# Abhängigkeiten und Lizenzen

Kurz: Zur Laufzeit braucht die Anwendung nur Node.js (mit eingebautem SQLite) im Container und einen Browser auf
dem Gerät. Es gibt keine npm-Pakete, keine Cloud-Dienste und keine laufenden Lizenzkosten. Werkzeuge, die nur zum
Prüfen dienen, stehen getrennt.

## Laufzeit

| Komponente | Anbieter | Lizenz | Wofür | Alternative | Aufwand für einen Austausch |
|---|---|---|---|---|---|
| Node.js 24 (Image `node:24-alpine`) | OpenJS Foundation | MIT | Server | jede Node.js-Version ab 24 | keiner (Versionswechsel) |
| SQLite (in Node.js als `node:sqlite`) | SQLite-Projekt | gemeinfrei | Datenbank | PostgreSQL | gering: Datenzugriff liegt in `server/db.js` und `server/app.js` |
| Alpine Linux (Basis des Images) | Alpine Linux | verschiedene freie Lizenzen | Betriebssystem im Container | Debian (`node:24-bookworm-slim`) | keiner |
| Docker Engine / Compose | Docker, Moby-Projekt | Apache-2.0 | Bereitstellung | Podman, systemd mit Node.js | gering |
| Browser des Geräts | – | – | App, Service Worker, IndexedDB, Web Speech API (Vorlesen), BarcodeDetector (QR, wo vorhanden) | – | – |

Keine Komponente wird über eine proprietäre Schnittstelle angesprochen. Vorlesen nutzt die Sprachausgabe des
Geräts; ohne deutsche Stimme bleibt der Knopf verborgen.

## Daten und Inhalte

| Bestandteil | Quelle | Lizenz |
|---|---|---|
| Kartengrundlage (Umriss Sachsens, Nachbarregionen, Flüsse) | Natural Earth 5.1.2 (`ne_10m_admin_1_states_provinces`, `ne_10m_rivers_lake_centerlines`, `ne_10m_rivers_europe`) | gemeinfrei |
| Lage der Städte auf der Karte | eigene Liste (Fakten) | – |
| Orte, Aufgaben, Sammelstücke, Bilder | eigene Werke (`inhalte/`, `assets/spiele/`; Nachweise in `inhalte/BILDNACHWEIS.md`) | CC BY-SA 4.0 |
| Programmcode | eigener Code | AGPL-3.0-only |

## Nur zum Prüfen (nicht im Betrieb)

| Werkzeug | Lizenz | Wofür |
|---|---|---|
| `chromedp/headless-shell` (Chrome ohne Oberfläche) | BSD-3-Clause (Chromium) | Browser-Prüfläufe in `test/e2e/` |
| axe-core 4.10.2 (zur Laufzeit des Prüflaufs von jsDelivr geladen) | MPL-2.0 | Barrierefreiheitsprüfung |

## Prüfen, dass es so bleibt

`package.json` hat keine `dependencies`; `node --test` läuft ohne Installation. Ein neues Laufzeitpaket ist eine
bewusste Entscheidung und gehört in diese Tabelle.
