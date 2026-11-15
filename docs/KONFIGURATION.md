# Konfiguration

Alle Einstellungen kommen aus Umgebungsvariablen (im Betrieb über `.env`, Vorlage `.env.beispiel`). Geheimnisse
stehen nur in `.env` auf dem Server, nie im Repository. Die Tabelle nennt Bedeutung, Standardwert und zulässigen
Bereich.

| Variable | Bedeutung | Standard | Zulässig |
|---|---|---|---|
| `SPUR_OEFFENTLICHE_URL` | Adresse, unter der Nutzende die Anwendung erreichen; Grundlage für Rücksprungadressen der Anmeldung und QR-Codes | `http://localhost:<Port>` | absolute URL ohne Schrägstrich am Ende; im Betrieb `https://…` |
| `SPUR_HOST` | Adresse, an die der Server bindet | `127.0.0.1` (im Container `0.0.0.0`) | IP-Adresse |
| `SPUR_PORT` | Port des Servers | `8080` | 1–65535 |
| `SPUR_HOST_PORT` | Port auf `127.0.0.1` des Hosts (nur `compose.yaml`) | `8080` | 1–65535 |
| `SPUR_DATEN` | Ordner für Datenbank und Sicherungen | `daten/` bzw. `/daten` im Container | beschreibbarer Ordner |
| `SPUR_INHALTE` | Wurzel der Inhalte (`inhalte/`, `spiele/`, `assets/spiele/`) | Wurzel des Repositorys | Ordner |
| `SPUR_SICHERE_COOKIES` | Sitzungs-Cookies nur über https | an, wenn die öffentliche URL mit `https://` beginnt | `0`/`1` |
| `SPUR_VERWALTUNG_SCHLUESSEL` | Schlüssel der Verwaltung | leer: wird beim ersten Start erzeugt und einmal ins Protokoll geschrieben | ab 16 Zeichen |
| `SPUR_AUSSTELLUNG_TOKEN` | Bearer-Token des Ausstellungssystems für `/api/v1/ausstellung/…` | leer: Abruf gesperrt | ab 24 Zeichen |
| `SPUR_AUSSTELLUNG_OFFEN` | Freigegebene Bildbeiträge ohne Token abrufbar | `0` | `0`/`1` |
| `SPUR_MESSWERTE_TOKEN` | Bearer-Token für `/api/v1/betrieb/messwerte` | leer: Messwerte gesperrt | ab 24 Zeichen |
| `SPUR_BETRIEB_SCHLUESSEL` | Schlüssel der Betriebsseite `/betrieb.html` (Telefondienst) | leer: wird beim ersten Start erzeugt und einmal ins Protokoll geschrieben | ab 16 Zeichen |
| `SPUR_BETRIEB_AGENT_TOKEN` | Bearer-Token des Betriebsdienstes am Server (`betrieb/spur wache`) für `/api/v1/betrieb/agent` | leer: Betriebsdienst aus, Knopf „Letzte Version zurückspielen“ gesperrt | ab 24 Zeichen |
| `SPUR_BETRIEB_KONTAKT` | Wen der Betrieb anruft, wenn nichts hilft (steht auf der Betriebsseite unter „Hilfe“) | leer | bis 160 Zeichen |
| `SPUR_BILD` | Name des Docker-Bildes (nur `compose.yaml` und `betrieb/spur`) | `spurensuche` | Name |
| `SPUR_VERSION_BILD` | Version des Bildes; setzt `betrieb/spur` beim Bauen aus dem Git-Tag (Build-Argument `VERSION`) | leer: Version aus `server/app.js` | Text |
| `SPUR_OIDC_AUSSTELLER` | Aussteller (Issuer) des Anmeldedienstes | leer: keine Anmeldung über den Dienst | URL ohne Schrägstrich am Ende |
| `SPUR_OIDC_CLIENT_ID` | Kennung der Anwendung beim Anmeldedienst | `spurensuche` | Text |
| `SPUR_OIDC_CLIENT_SECRET` | Geheimnis der Anwendung beim Anmeldedienst | – (Pflicht, wenn ein Aussteller gesetzt ist) | Text |
| `SPUR_OIDC_INTERN` | andere Basisadresse für Aufrufe vom Server zum Anmeldedienst (z. B. internes Netz) | leer | URL |
| `SPUR_OIDC_ROLLEN_MERKMAL` | Name des Merkmals mit der Rolle im ID-Token | `rolle` | Text |
| `SPUR_OIDC_ROLLEN_LEHRKRAFT` | Werte, die als Lehrkraft gelten | `lehrkraft` | durch Komma getrennt |
| `SPUR_OIDC_ROLLEN_LERNENDE` | Werte, die als Lernende gelten | `schueler,lernende` | durch Komma getrennt |
| `SPUR_LERNENDE_ANMELDUNG` | Müssen Lernende vor dem Beitritt angemeldet sein? | `optional` | `optional`, `pflicht` |
| `SPUR_AUFBEWAHRUNG_WOCHEN` | Löschfrist der Gruppendaten nach Ende der Quest | `12` | 1–52 (höchstens bis Schuljahresende) |
| `SPUR_STAND_BEZEICHNUNG` | Bezeichnung des Stands, sichtbar für Lehrkräfte und unter „Über die Spurensuche“ (z. B. „Stand Workshop 2“), damit Rückmeldungen einem Stand zugeordnet werden | leer | bis 40 Zeichen |
| `SPUR_WERKSTATT` | Werkstatt-Seite zum Prüfen einzelner Spiele | `0` | `0`/`1`, nur in Test und Entwicklung |
| `SPUR_PROTOKOLL_AUFRUFE` | jede Anfrage protokollieren (Methode, Routenklasse, Status, Dauer; keine IP, keine Parameter) | `0` | `0`/`1` |
| `SPUR_ATTRAPPE` | Attrappe des Anmeldedienstes mit Testkonten unter `/attrappe` | `0` | `0`/`1`, nie in Produktion |
| `SPUR_SICHERUNG_SCHLUESSEL` | Schlüssel der Sicherungen (32 Byte, Base64) | – (ohne Schlüssel keine Sicherung) | Base64 |
| `SPUR_SICHERUNG_SCHLUESSELDATEI` | Alternative: Datei mit dem Schlüssel | – | Pfad |
| `SPUR_SICHERUNG_ORDNER` | Ziel der Sicherungen | `SPUR_DATEN/sicherungen` | Ordner |
| `SPUR_SICHERUNG_ANZAHL` | aufbewahrte Sicherungen | `14` | 1–365 |
| `TZ` | Zeitzone für die tägliche Sicherung um 02:00 Uhr und für Datumsangaben | `UTC` | z. B. `Europe/Berlin` |

Feste Werte im Code (Änderung nur mit neuer Version): Sitzungsdauer Lehrkraft 12 Stunden, Lernende 8 Stunden,
Verwaltung 2 Stunden; höchstens 16 Gruppen je Quest, 15 Orte je Quest, 12 Sammelstücke je Bild; Anfragegröße
1 MB (Bildbeiträge 16 MB); Bremse 20 Fehlversuche je Absender und Minute für Codes und Schlüssel. Hinter einem
Reverse Proxy sieht die Anwendung nur dessen Adresse; dann gilt die Bremse für alle Absender zusammen (die Weitergabe
der Absenderadresse durch den Proxy ist noch nicht eingebaut).
