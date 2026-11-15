#!/usr/bin/env node
// Erzeugt docs/openapi.json (OpenAPI 3.1) aus einer knappen Beschreibung. Der Test test/openapi.test.js prüft, dass
// jede Route aus server/app.js hier steht und umgekehrt.
import { writeFileSync } from 'node:fs';
import { VERSION } from '../server/app.js';

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema, beschreibung = 'OK') => ({ description: beschreibung, content: { 'application/json': { schema } } });
const fehler = (...codes) => Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/F${c}` }]));
const koerper = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const pfadId = (name = 'id', beschreibung = 'Kennung') => ({ name, in: 'path', required: true, schema: { type: 'string' }, description: beschreibung });
const SITZUNG = [{ sitzung: [] }];
const GERAET = [{ geraet: [] }];

const schemas = {
  Fehler: { type: 'object', required: ['fehler'], properties: { fehler: { type: 'string' }, hinweis: { type: 'string' }, bestaetigen: { type: 'boolean' } } },
  Zweitext: { type: 'object', required: ['standard', 'einfach'], properties: { standard: { type: 'string' }, einfach: { type: 'string' } } },
  QuestOrt: { type: 'object', required: ['ort', 'aufgaben'], properties: { ort: { type: 'string' }, aufgaben: { type: 'array', items: { type: 'string' } } } },
  Freigabe: { type: 'object', properties: { id: { type: 'string' }, titel: { type: 'string' }, orte: { type: 'array', items: ref('QuestOrt') }, erfassung: { type: 'boolean', description: 'false: Kernzielgruppe nicht erfüllt oder Einwilligung nicht bestätigt; es entstehen keine Datensätze' }, rueckmeldung: { type: 'boolean' }, beendet: { type: ['string', 'null'], format: 'date-time' } } },
  Ereignis: { type: 'object', required: ['art', 'zeit'], properties: { art: { enum: ['versuch', 'weg', 'hilfe', 'neuer-anlauf', 'rolle', 'abstimmung'] }, zeit: { type: 'number', description: 'Millisekunden seit Beginn der Aufgabe' }, wert: { description: 'Zahl, true/false oder Kennung ^[a-z0-9-]{1,40}$; alles andere wird verworfen' } } },
  Station: { type: 'object', required: ['ort', 'status', 'begonnen'], properties: { ort: { type: 'string' }, status: { enum: ['begonnen', 'abgeschlossen', 'abgebrochen'] }, verifikation: { enum: ['qr', 'code', 'gps', 'ersatz', null] }, begonnen: { type: 'string', format: 'date-time' }, beendet: { type: ['string', 'null'], format: 'date-time' }, aktivSekunden: { type: 'number' } } },
  Lauf: { type: 'object', required: ['id', 'aufgabe', 'geloest', 'beendet'], properties: { id: { type: 'string', format: 'uuid', description: 'vom Gerät vergeben; derselbe Lauf wird nie doppelt gezählt' }, aufgabe: { type: 'string', example: 'bastei/1' }, geloest: { type: 'boolean' }, dauerSekunden: { type: 'number' }, items: { type: 'array', items: { type: 'string' } }, ereignisse: { type: 'array', items: ref('Ereignis') }, beendet: { type: 'string', format: 'date-time' } } },
  Sync: { type: 'object', required: ['schluessel'], properties: { schluessel: { type: 'string', format: 'uuid', description: 'Wiederholungsschlüssel: dieselbe Übertragung wird nur einmal verarbeitet' }, stationen: { type: 'array', maxItems: 50, items: ref('Station') }, laeufe: { type: 'array', maxItems: 100, items: ref('Lauf') }, technik: { type: 'array', items: { type: 'object', properties: { schluessel: { type: 'string' }, art: { enum: ['offline', 'online'] }, zeit: { type: 'string', format: 'date-time' } } } }, rueckmeldungen: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, aufgabe: { type: 'string' }, verstaendlich: { enum: ['ja', 'teils', 'nein'] }, spass: { enum: ['ja', 'teils', 'nein'] }, schwierigkeit: { enum: ['zu-leicht', 'passend', 'zu-schwer'] } } } } } },
  SyncAntwort: { type: 'object', properties: { erfasst: { type: 'boolean' }, erfassung: { type: 'boolean' }, doppelt: { type: 'boolean' }, angenommen: { type: 'object' }, abgelehnt: { type: 'array', items: { type: 'object' } } } },
  BildMetadaten: { type: 'object', required: ['kennung', 'erstellt', 'art', 'items'], additionalProperties: false, properties: { kennung: { type: 'string', format: 'uuid' }, erstellt: { type: 'string', format: 'date-time' }, art: { enum: ['item-collage'] }, items: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string' } } } },
  BildUpload: { type: 'object', required: ['metadaten', 'png', 'vorschau'], properties: { metadaten: ref('BildMetadaten'), png: { type: 'string', contentEncoding: 'base64', description: 'PNG, genau 2048 × 2048' }, vorschau: { type: 'string', contentEncoding: 'base64', description: 'WebP oder JPEG, höchstens 512 × 512' }, freigabe: { type: 'boolean', description: 'Pflicht (true) ohne Gerätetoken: Familien geben selbst frei' } } },
  Ausstellungseintrag: { type: 'object', properties: { kennung: { type: 'string', format: 'uuid' }, erstellt: { type: 'string', format: 'date-time' }, freigegeben: { type: 'string', format: 'date-time' }, art: { enum: ['item-collage', 'ki-generiert'] }, items: { type: 'array', items: { type: 'string' } }, bild: { type: 'string', format: 'uri-reference' }, vorschau: { type: 'string', format: 'uri-reference' }, sha256: { type: 'string' } } },
  Lerngruppe: { type: 'object', properties: { bezeichnung: { type: 'string', minLength: 2, maxLength: 40 }, klassenstufe: { type: ['integer', 'null'], minimum: 1, maximum: 13 }, einwilligung: { type: 'boolean' } } },
  Auswertung: { type: 'object', description: 'Beobachtungen, Kompetenzraster und Formulierungsentwurf einer Gruppe (Regeln: docs/AUSWERTUNG.md)', properties: { gruppe: { type: 'object' }, quest: { type: 'string' }, beobachtungen: { type: 'object' }, raster: { type: 'object' }, einschaetzung: { type: 'object' }, entwurf: { type: 'string' }, loeschenAm: { type: 'string', format: 'date-time' } } },
};

const paths = {
  '/api/v1/status': { get: { summary: 'Zustand der Instanz', tags: ['Betrieb'], responses: { 200: json({ type: 'object', properties: { ok: { type: 'boolean' }, version: { type: 'string' }, schema: { type: 'integer' }, inhaltVersion: { type: 'string' }, inhaltFehler: { type: 'integer' } } }) } } },
  '/api/v1/beitritt': { post: { summary: 'Gerät tritt mit dem Code der Lehrkraft einer Gruppe bei', tags: ['Gerät'], requestBody: koerper({ type: 'object', required: ['code'], properties: { code: { type: 'string', example: 'K7QH-M3PZ' } } }), responses: { 200: json({ type: 'object', properties: { token: { type: 'string', description: 'Gerätetoken (Bearer)' }, gruppe: { type: 'object', properties: { bezeichnung: { type: 'string' } } }, freigabe: ref('Freigabe') } }), ...fehler(401, 404, 429) } } },
  '/api/v1/geraet': { get: { summary: 'aktueller Stand der Freigabe für das Gerät', tags: ['Gerät'], security: GERAET, responses: { 200: json({ type: 'object', properties: { gruppe: { type: 'object' }, freigabe: ref('Freigabe') } }), ...fehler(401, 410) } } },
  '/api/v1/sync': { post: { summary: 'Stationen, Aufgabenläufe und Netzwechsel übertragen (wiederholungssicher)', tags: ['Gerät'], security: GERAET, requestBody: koerper(ref('Sync')), responses: { 200: json(ref('SyncAntwort')), ...fehler(400, 401, 410, 413) } } },
  '/api/v1/bildbeitraege': { post: { summary: 'Bildbeitrag hochladen (Schulgruppe: wartet auf Freigabe; Familie: nur selbst freigegeben)', tags: ['Gerät'], security: [{ geraet: [] }, {}], requestBody: koerper(ref('BildUpload')), responses: { 200: json({ type: 'object' }, 'schon vorhanden'), 201: json({ type: 'object', properties: { kennung: { type: 'string' }, status: { enum: ['wartet', 'freigegeben'] } } }, 'angelegt'), ...fehler(400, 401, 410, 413, 429) } } },

  '/anmeldung/start': { get: { summary: 'Anmeldung beim Anmeldedienst beginnen (Weiterleitung)', tags: ['Anmeldung'], parameters: [{ name: 'ziel', in: 'query', schema: { enum: ['lehrkraft', 'lernende'] } }], responses: { 302: { description: 'zum Anmeldedienst oder mit #fehler=… zurück' } } } },
  '/anmeldung/rueckkehr': { get: { summary: 'Rückkehr vom Anmeldedienst (Code gegen Token, Prüfung, Sitzung)', tags: ['Anmeldung'], parameters: [{ name: 'code', in: 'query', schema: { type: 'string' } }, { name: 'state', in: 'query', schema: { type: 'string' } }], responses: { 302: { description: 'zur Oberfläche, mit Sitzungs-Cookie oder #fehler=…' } } } },
  '/api/v1/anmeldung/schluessel': { post: { summary: 'Anmeldung einer Lehrkraft mit Zugangsschlüssel', tags: ['Anmeldung'], requestBody: koerper({ type: 'object', required: ['schluessel'], properties: { schluessel: { type: 'string' } } }), responses: { 200: json({ type: 'object' }, 'angemeldet (Set-Cookie)'), ...fehler(401, 429) } } },
  '/api/v1/anmeldung/verwaltung': { post: { summary: 'Anmeldung der Verwaltung', tags: ['Anmeldung'], requestBody: koerper({ type: 'object', required: ['schluessel'], properties: { schluessel: { type: 'string' } } }), responses: { 200: json({ type: 'object' }, 'angemeldet (Set-Cookie)'), ...fehler(401, 429) } } },
  '/api/v1/abmeldung': { post: { summary: 'Abmelden; liefert die Adresse der zentralen Abmeldung, falls vorhanden', tags: ['Anmeldung'], responses: { 200: json({ type: 'object', properties: { abgemeldet: { type: 'boolean' }, weiter: { type: ['string', 'null'] } } }) } } },
  '/api/v1/ich': { get: { summary: 'Rolle der aktuellen Sitzung (null ohne Sitzung)', tags: ['Anmeldung'], responses: { 200: json({ type: 'object', properties: { rolle: { enum: ['lehrkraft', 'lernende', 'verwaltung', null] } } }) } } },

  '/api/v1/lerngruppen': {
    get: { summary: 'eigene Lerngruppen mit Quests', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...fehler(401) } },
    post: { summary: 'Lerngruppe anlegen', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper(ref('Lerngruppe')), responses: { 201: json({ type: 'object', properties: { id: { type: 'string' } } }, 'angelegt'), ...fehler(400, 401) } },
  },
  '/api/v1/lerngruppen/{id}': {
    parameters: [pfadId()],
    patch: { summary: 'Lerngruppe ändern, Einwilligung bestätigen oder zurücknehmen', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper(ref('Lerngruppe')), responses: { 200: json({ type: 'object' }), ...fehler(400, 401, 404) } },
    delete: { summary: 'Lerngruppe mit allen Quests und Gruppen löschen', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401, 404) } },
  },
  '/api/v1/lerngruppen/{id}/freigaben': { parameters: [pfadId()], post: { summary: 'Quest freigeben (Orte, Aufgaben, Zeitrahmen; Erfassung nach Kernzielgruppe und Einwilligung)', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper({ type: 'object', required: ['titel', 'orte'], properties: { titel: { type: 'string' }, zeitrahmen: { enum: ['stunde', 'projekttag', 'ausflug', 'eigen'] }, orte: { type: 'array', items: ref('QuestOrt') }, rueckmeldung: { type: 'boolean' } } }), responses: { 201: json({ type: 'object' }, 'freigegeben'), ...fehler(400, 401, 404) } } },
  '/api/v1/freigaben/{id}': {
    parameters: [pfadId()],
    get: { summary: 'Quest mit laufender Übersicht aller Gruppen (Station, Stand; ohne Stufen)', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401, 404) } },
    delete: { summary: 'Quest mit allen Gruppen und Beobachtungen löschen', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401, 404) } },
  },
  '/api/v1/freigaben/{id}/beenden': { parameters: [pfadId()], post: { summary: 'Quest beenden; die Löschfrist beginnt', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401, 404) } } },
  '/api/v1/freigaben/{id}/gruppen': { parameters: [pfadId()], post: { summary: 'Gruppe anlegen (neutrale Bezeichnung; freie Bezeichnung nur mit Bestätigung)', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper({ type: 'object', required: ['bezeichnung'], properties: { bezeichnung: { type: 'string', maxLength: 24 }, bestaetigt: { type: 'boolean' } } }), responses: { 201: json({ type: 'object', properties: { id: { type: 'string' }, bezeichnung: { type: 'string' }, code: { type: 'string' } } }, 'angelegt'), ...fehler(400, 401, 404, 409) } } },
  '/api/v1/freigaben/{id}/bildbeitraege': { parameters: [pfadId()], get: { summary: 'Bildbeiträge der Gruppen dieser Quest', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...fehler(401, 404) } } },
  '/api/v1/freigaben/{id}/rueckmeldungen.csv': { parameters: [pfadId()], get: { summary: 'Rückmeldungen der Workshops als CSV', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: { description: 'CSV', content: { 'text/csv': { schema: { type: 'string' } } } }, ...fehler(401, 404) } } },
  '/api/v1/gruppen/{id}': {
    parameters: [pfadId()],
    patch: { summary: 'Gruppe umbenennen oder Einschätzung (Stufe je Bereich) setzen', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper({ type: 'object', properties: { bezeichnung: { type: 'string' }, bestaetigt: { type: 'boolean' }, einschaetzung: { type: 'object', additionalProperties: { enum: ['einblick', 'kennen', 'anwenden', 'beurteilen', 'gestalten', null] } } } }), responses: { 200: json({ type: 'object' }), ...fehler(400, 401, 404, 409) } },
    delete: { summary: 'Gruppendaten sofort löschen', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401, 404) } },
  },
  '/api/v1/gruppen/{id}/auswertung': { parameters: [pfadId()], get: { summary: 'Beobachtungen, Kompetenzraster, Formulierungsentwurf', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: json(ref('Auswertung')), ...fehler(401, 404) } } },
  '/api/v1/bildbeitraege/entscheidung': { post: { summary: 'Bildbeiträge einzeln oder gesammelt freigeben oder ablehnen', tags: ['Lehrkraft'], security: SITZUNG, requestBody: koerper({ type: 'object', required: ['kennungen', 'freigeben'], properties: { kennungen: { type: 'array', items: { type: 'string', format: 'uuid' } }, freigeben: { type: 'boolean' } } }), responses: { 200: json({ type: 'object', properties: { geaendert: { type: 'integer' } } }), ...fehler(400, 401) } } },
  '/api/v1/bildbeitraege/{kennung}/vorschau': { parameters: [pfadId('kennung', 'UUID des Bildbeitrags')], get: { summary: 'Vorschau für die Lehrkraft (auch vor der Freigabe)', tags: ['Lehrkraft'], security: SITZUNG, responses: { 200: { description: 'Bild', content: { 'image/webp': {}, 'image/jpeg': {} } }, ...fehler(401, 404) } } },

  '/api/v1/ausstellung/bildbeitraege': { get: { summary: 'freigegebene Bildbeiträge, nach Freigabezeit, seitenweise', tags: ['Ausstellung'], security: [{ ausstellung: [] }], parameters: [{ name: 'seit', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'nur danach freigegebene (für fortlaufenden Abruf: naechsteSeit der letzten Antwort)' }, { name: 'grenze', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } }], responses: { 200: json({ type: 'object', properties: { eintraege: { type: 'array', items: ref('Ausstellungseintrag') }, weitere: { type: 'boolean' }, naechsteSeit: { type: ['string', 'null'] } } }), ...fehler(400, 401) } } },
  '/api/v1/ausstellung/bildbeitraege/{kennung}': { parameters: [pfadId('kennung', 'UUID')], get: { summary: 'Metadaten eines freigegebenen Bildbeitrags (ohne Gruppenbezeichnung)', tags: ['Ausstellung'], security: [{ ausstellung: [] }], responses: { 200: json(ref('Ausstellungseintrag')), ...fehler(401, 404) } } },
  '/api/v1/ausstellung/bildbeitraege/{kennung}/bild.png': { parameters: [pfadId('kennung', 'UUID')], get: { summary: 'Bilddatei (PNG, 2048 × 2048)', tags: ['Ausstellung'], security: [{ ausstellung: [] }], responses: { 200: { description: 'PNG', content: { 'image/png': {} } }, ...fehler(401, 404) } } },
  '/api/v1/ausstellung/bildbeitraege/{kennung}/vorschau': { parameters: [pfadId('kennung', 'UUID')], get: { summary: 'Vorschau (WebP oder JPEG, höchstens 512 × 512)', tags: ['Ausstellung'], security: [{ ausstellung: [] }], responses: { 200: { description: 'Bild', content: { 'image/webp': {}, 'image/jpeg': {} } }, ...fehler(401, 404) } } },
  '/api/v1/ausstellung/archiv.zip': { get: { summary: 'alle freigegebenen Bildbeiträge als Archiv (BagIt in ZIP, SHA-256 je Datei)', tags: ['Ausstellung'], security: [{ ausstellung: [] }], responses: { 200: { description: 'ZIP', content: { 'application/zip': {} } }, ...fehler(401) } } },

  '/api/v1/verwaltung/uebersicht': { get: { summary: 'Zustand: Version, Inhalte, Offline-Paket, Anzahlen, letzte Sicherung', tags: ['Verwaltung'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401) } } },
  '/api/v1/verwaltung/zugangsschluessel': {
    get: { summary: 'Zugangsschlüssel (ohne Schlüssel)', tags: ['Verwaltung'], security: SITZUNG, responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...fehler(401) } },
    post: { summary: 'Zugangsschlüssel anlegen (wird nur einmal angezeigt)', tags: ['Verwaltung'], security: SITZUNG, requestBody: koerper({ type: 'object', required: ['bezeichnung'], properties: { bezeichnung: { type: 'string' } } }), responses: { 201: json({ type: 'object', properties: { id: { type: 'integer' }, schluessel: { type: 'string' } } }, 'angelegt'), ...fehler(400, 401) } },
  },
  '/api/v1/verwaltung/zugangsschluessel/{id}': { parameters: [pfadId('id', 'Nummer')], patch: { summary: 'sperren (meldet sofort ab) oder entsperren', tags: ['Verwaltung'], security: SITZUNG, requestBody: koerper({ type: 'object', properties: { gesperrt: { type: 'boolean' } } }), responses: { 200: json({ type: 'object' }), ...fehler(401) } } },
  '/api/v1/verwaltung/archiv.zip': { get: { summary: 'Archiv (Inhalte, Konfiguration, freigegebene Bildbeiträge) oder vollständiger Export (zusätzlich Gruppendaten); BagIt in ZIP', tags: ['Verwaltung'], security: SITZUNG, parameters: [{ name: 'umfang', in: 'query', schema: { enum: ['archiv', 'vollstaendig'], default: 'archiv' } }], responses: { 200: { description: 'ZIP', content: { 'application/zip': {} } }, ...fehler(401) } } },
  '/api/v1/verwaltung/protokoll': { get: { summary: 'letzte 500 Verwaltungsaktionen (Zeit, Rolle, Aktion, Ziel; ohne Personendaten)', tags: ['Verwaltung'], security: SITZUNG, responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...fehler(401) } } },
  '/api/v1/verwaltung/inhalte-neu-laden': { post: { summary: 'Inhalte neu laden und prüfen', tags: ['Verwaltung'], security: SITZUNG, responses: { 200: json({ type: 'object' }), ...fehler(401) } } },
  '/api/v1/betrieb/messwerte': { get: { summary: 'Messwerte für das Monitoring (Prometheus-Textformat)', tags: ['Betrieb'], security: [{ messwerte: [] }], responses: { 200: { description: 'Text', content: { 'text/plain': {} } }, ...fehler(401) } } },
};

const responses = Object.fromEntries([400, 401, 404, 409, 410, 413, 429].map((c) => [`F${c}`, json(ref('Fehler'), { 400: 'Eingabe ungültig', 401: 'nicht angemeldet', 404: 'nicht gefunden', 409: 'Konflikt oder Bestätigung nötig', 410: 'Gruppe gelöscht', 413: 'zu groß', 429: 'zu viele Versuche' }[c])]));

const dokument = {
  openapi: '3.1.0',
  info: { title: 'Spurensuche', version: VERSION, description: 'Schnittstelle der Spurensuche: Geräte der Gruppen, Lehrkräfte, Ausstellung, Verwaltung, Betrieb. Versioniert über den Pfad /api/v1. Fehler: docs/FEHLERKATALOG.md.', license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' } },
  servers: [{ url: '/' }],
  tags: ['Gerät', 'Anmeldung', 'Lehrkraft', 'Ausstellung', 'Verwaltung', 'Betrieb'].map((name) => ({ name })),
  paths,
  components: {
    schemas,
    responses,
    securitySchemes: {
      sitzung: { type: 'apiKey', in: 'cookie', name: 'spur_sitzung', description: 'HttpOnly, SameSite=Strict' },
      geraet: { type: 'http', scheme: 'bearer', description: 'Gerätetoken aus /api/v1/beitritt' },
      ausstellung: { type: 'http', scheme: 'bearer', description: 'SPUR_AUSSTELLUNG_TOKEN' },
      messwerte: { type: 'http', scheme: 'bearer', description: 'SPUR_MESSWERTE_TOKEN' },
    },
  },
};
writeFileSync(new URL('../docs/openapi.json', import.meta.url), `${JSON.stringify(dokument, null, 2)}\n`);
console.log(`docs/openapi.json: ${Object.keys(paths).length} Pfade`);
