# Installation

Kurz: Ein Linux-Server mit Docker genügt. Repository holen, `.env` ausfüllen, `docker compose up -d`. Davor ein
Reverse Proxy mit TLS. Es gibt keine weiteren Pakete, keine Datenbank-Server und keine Lizenzkosten.

## Voraussetzungen

- Linux-Server (virtuelle Maschine genügt) mit Docker Engine 24 oder neuer und Docker Compose v2
- 2 CPU-Kerne und 2 GB Arbeitsspeicher als Ausgangspunkt (der Lasttest im Ordner `nachweis/` läuft auf genau
  diesem Zuschnitt); 5 GB Plattenplatz für Datenbank und Sicherungen
- ein DNS-Name und ein Reverse Proxy mit TLS (Beispiel unten: Caddy, holt Zertifikate selbst)
- Rechenzentrum in der EU

## Schritte

```bash
git clone https://github.com/panoherbe/spurensuche.git
cd spurensuche
cp .env.beispiel .env
# .env öffnen: SPUR_OEFFENTLICHE_URL, SPUR_VERWALTUNG_SCHLUESSEL, SPUR_AUSSTELLUNG_TOKEN,
# SPUR_MESSWERTE_TOKEN und SPUR_SICHERUNG_SCHLUESSEL setzen (Zufallswerte: openssl rand -base64 32)
docker compose up -d --build
curl -s http://127.0.0.1:8080/api/v1/status
```

Die Antwort von `/api/v1/status` enthält `"ok": true`, die Version und die Zahl der Inhaltsfehler (soll `0` sein).

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

1. `https://<adresse>/verwaltung.html` öffnen und mit `SPUR_VERWALTUNG_SCHLUESSEL` anmelden.
2. Für die Erprobung Zugangsschlüssel für Lehrkräfte anlegen (jeder Schlüssel erscheint nur einmal).
3. QR-Schilder der Orte als PDF herunterladen und drucken.
4. Lehrkräfte melden sich unter `/lehrkraefte.html` an, legen eine Lerngruppe an und geben eine Quest frei.
5. Sobald der schulische Anmeldedienst angebunden ist: `SPUR_OIDC_*` setzen (docs/ANMELDUNG.md) und neu starten.

## Inhalte

Die Inhalte (Orte, Aufgaben, Spiele, Bilder) liegen im Repository unter `inhalte/`, `spiele/` und `assets/spiele/`.
Für eigene Inhalte das Austauschformat in `docs/SCHNITTSTELLE.md` nutzen, mit `node tools/pruefe-inhalte.js`
prüfen und in der Verwaltung „Inhalte neu laden“ wählen (oder neu starten). Inhalte außerhalb des Images:
`SPUR_INHALTE` auf einen eingebundenen Ordner setzen.

## Vorführung ohne Server

`node tools/statisch-bauen.js <ordner>` erzeugt eine statische Fassung mit Beispieldaten, die in jedem Webserver
unter jedem Pfad läuft (nichts wird übertragen; alles bleibt im Browser).
