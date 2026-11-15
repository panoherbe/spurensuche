# Installation

Kurz: Ein Linux-Server mit Docker genügt. Repository holen, `betrieb/spur einrichten` (erzeugt alle Schlüssel,
baut, startet), Betriebsdienst einrichten. Davor ein Reverse Proxy mit TLS. Es gibt keine weiteren Pakete, keine
Datenbank-Server und keine Lizenzkosten.

## Voraussetzungen

- Linux-Server (virtuelle Maschine genügt) mit Docker Engine 24 oder neuer, Docker Compose v2, `git` und `curl`
- 2 CPU-Kerne und 2 GB Arbeitsspeicher als Ausgangspunkt (der Lasttest im Ordner `nachweis/` läuft auf genau
  diesem Zuschnitt); 5 GB Plattenplatz für Datenbank und Sicherungen
- ein DNS-Name und ein Reverse Proxy mit TLS (Beispiel unten: Caddy, holt Zertifikate selbst)
- Rechenzentrum in der EU

## Schritte

```bash
sudo git clone https://github.com/panoherbe/spurensuche.git /srv/spurensuche
sudo chown -R "$USER" /srv/spurensuche && cd /srv/spurensuche
cp .env.beispiel .env && chmod 600 .env
# .env öffnen: SPUR_OEFFENTLICHE_URL (https://…) und SPUR_BETRIEB_KONTAKT eintragen; leere Schlüssel füllt der nächste Schritt
betrieb/spur einrichten              # Schlüssel erzeugen, Version bauen, starten, auf Antwort warten
sudo betrieb/spur dienst             # Betriebsdienst als systemd-Dienst (Knopf „Letzte Version“, Neustart bei Hänger)
betrieb/spur status
```

`einrichten` füllt in `.env` jeden leeren Schlüssel mit einem Zufallswert (Verwaltung und Betrieb als lesbarer
Code `ABCD-EFGH-JKLM-NPQR`, Tokens mit 40 Zeichen, Sicherungsschlüssel mit 32 Byte), baut die Version des
Checkouts als Bild `spurensuche:<version>` und `spurensuche:aktuell` und startet beide Dienste. Den
Sicherungsschlüssel zusätzlich getrennt vom Server aufbewahren. Dem Telefondienst nur den Betriebsschlüssel geben.

Ohne das Werkzeug geht es auch so: `.env` von Hand füllen (Zufallswerte: `openssl rand -base64 32`), dann
`docker compose up -d --build`. Die Antwort von `curl -s http://127.0.0.1:8080/api/v1/status` enthält
`"ok": true`, die Version und die Zahl der Inhaltsfehler (soll `0` sein).

## Reverse Proxy (Beispiel Caddy)

```
spurensuche.example.org {
	encode gzip
	reverse_proxy 127.0.0.1:8080
}
```

Der Container hört nur auf `127.0.0.1` des Hosts. Zertifikate erneuert Caddy selbst; die Anwendung muss dafür
nicht angehalten werden.

## Erste Schritte nach der Installation

1. `https://<adresse>/betrieb.html` öffnen, mit `SPUR_BETRIEB_SCHLUESSEL` anmelden: Die Ampel soll grün sein
   (die erste Sicherung entsteht beim Start des Sicherungsdienstes).
2. `https://<adresse>/verwaltung.html` öffnen und mit `SPUR_VERWALTUNG_SCHLUESSEL` anmelden.
3. Für die Erprobung Zugangsschlüssel für Lehrkräfte anlegen (jeder Schlüssel erscheint nur einmal).
4. QR-Schilder der Orte als PDF herunterladen und drucken.
5. Lehrkräfte melden sich unter `/lehrkraefte.html` an, legen eine Lerngruppe an und geben eine Quest frei.
6. Sobald der schulische Anmeldedienst angebunden ist: `SPUR_OIDC_*` setzen (docs/ANMELDUNG.md) und neu starten.

## Inhalte

Die Inhalte (Orte, Aufgaben, Spiele, Bilder) liegen im Repository unter `inhalte/`, `spiele/` und `assets/spiele/`.
Für eigene Inhalte das Austauschformat in `docs/SCHNITTSTELLE.md` nutzen und mit `node tools/inhalt-paket.js
<paket.zip>` ein Inhaltspaket bauen (prüft vorher alles); auf der Betriebsseite „Inhalt tauschen“ prüft und
aktiviert es ohne Neustart (docs/BETRIEB.md). Neue Spielformate (Programmcode) kommen nur mit einer neuen Version.

## Vorführung ohne Server

`node tools/statisch-bauen.js <ordner>` erzeugt eine statische Fassung mit Beispieldaten, die in jedem Webserver
unter jedem Pfad läuft (nichts wird übertragen; alles bleibt im Browser).
