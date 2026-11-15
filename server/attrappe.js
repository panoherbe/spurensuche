// Attrappe eines OpenID-Connect-Anmeldedienstes für Entwicklung, Tests und Vorführung. NUR mit SPUR_ATTRAPPE=1.
// Sie verhält sich wie ein echter Anbieter (Entdeckung, Anmeldeseite, Token mit RS256, JWKS, Abmeldung) und
// liefert absichtlich mehr Merkmale als nötig (Name, E-Mail, Schule), damit Tests zeigen, dass die App sie
// verwirft. Mit /attrappe/ausfall lässt sich ein Ausfall des Anbieters nachstellen.

import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';

const b64url = (b) => Buffer.from(b).toString('base64url');

export const TESTKONTEN = [
  { id: 'lehrkraft-1', anzeige: 'Lehrkraft A (Testkonto)', merkmale: { sub: 'a1f3c9e2-lk-0001', rolle: 'lehrkraft', name: 'Erika Beispiel', email: 'lehrkraft-a@schule.test', schule: 'Testschule Nord' } },
  { id: 'lehrkraft-2', anzeige: 'Lehrkraft B (Testkonto)', merkmale: { sub: 'b7d2e8f1-lk-0002', rolle: 'lehrkraft', name: 'Jonas Probe', email: 'lehrkraft-b@schule.test', schule: 'Testschule Süd' } },
  { id: 'lernende-1', anzeige: 'Schülerin/Schüler (Testkonto)', merkmale: { sub: 'c4b6a0d3-sch-0003', rolle: 'schueler', name: 'Kim Beispiel', email: 'kim@schule.test', klasse: '6a' } },
  { id: 'ohne-rolle', anzeige: 'Konto ohne Rollenmerkmal (Test)', merkmale: { sub: 'd9e1f2a3-xx-0004', name: 'Ohne Rolle' } },
];

const html = (titel, inhalt) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titel}</title><link rel="stylesheet" href="/attrappe/stil.css"></head><body><main><p class="marke">Anmeldedienst · Attrappe für Tests</p><h1>${titel}</h1>${inhalt}</main></body></html>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STIL = `body{font:18px/1.5 system-ui,sans-serif;margin:0;background:#eef1f4;color:#15212b}main{max-width:34rem;margin:3rem auto;background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 12px #0002}
.marke{color:#4a5a68;font-size:.9rem;margin:0}h1{font-size:1.6rem;margin:.3rem 0 1.2rem}button{display:block;width:100%;font:inherit;padding:.9rem 1rem;margin:.6rem 0;border-radius:10px;border:2px solid #24527a;background:#24527a;color:#fff;cursor:pointer;text-align:left}
button.leise{background:#fff;color:#24527a}button:focus-visible{outline:3px solid #b8860b;outline-offset:2px}p.hinweis{color:#4a5a68;font-size:.95rem}`;

export function attrappe({ aussteller, clients, jetzt = () => Date.now() }) {
  let schluessel = neuerSchluessel();
  let alt = null;
  let ausfall = false;
  const codes = new Map();
  const tokens = new Map();

  function neuerSchluessel() {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = b64url(randomBytes(8));
    return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
  }

  function idToken(konto, client, nonce) {
    const s = Math.floor(jetzt() / 1000);
    const kopf = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: schluessel.kid }));
    const daten = b64url(JSON.stringify({ iss: aussteller, aud: client, iat: s, exp: s + 300, nonce, auth_time: s, ...konto.merkmale }));
    const sig = sign('RSA-SHA256', Buffer.from(`${kopf}.${daten}`), schluessel.privateKey);
    return `${kopf}.${daten}.${b64url(sig)}`;
  }

  return {
    /** Bearbeitet eine Anfrage unter /attrappe. Liefert true, wenn sie beantwortet wurde. */
    async bearbeite(req, res, url, koerper) {
      const pfad = url.pathname.slice('/attrappe'.length) || '/';
      const sende = (status, kopf, inhalt) => { res.writeHead(status, { 'Cache-Control': 'no-store', ...kopf }); res.end(inhalt); return true; };
      const json = (status, daten) => sende(status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(daten));
      const seite = (status, titel, inhalt) => sende(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self' *; base-uri 'none'; frame-ancestors 'none'" }, html(titel, inhalt));

      if (pfad === '/stil.css') return sende(200, { 'Content-Type': 'text/css; charset=utf-8' }, STIL);
      if (pfad === '/ausfall') {
        if (req.method !== 'POST') return json(405, { fehler: 'POST erwartet' });
        ausfall = url.searchParams.get('an') === '1';
        return json(200, { ausfall });
      }
      if (pfad === '/schluesselwechsel' && req.method === 'POST') {
        alt = schluessel;
        schluessel = neuerSchluessel();
        return json(200, { kid: schluessel.kid });
      }
      if (ausfall) return json(503, { fehler: 'Anmeldedienst nicht erreichbar (nachgestellter Ausfall)' });

      if (pfad === '/.well-known/openid-configuration') {
        return json(200, {
          issuer: aussteller,
          authorization_endpoint: `${aussteller}/authorize`,
          token_endpoint: `${aussteller}/token`,
          jwks_uri: `${aussteller}/jwks`,
          userinfo_endpoint: `${aussteller}/userinfo`,
          end_session_endpoint: `${aussteller}/abmelden`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          subject_types_supported: ['pairwise'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'],
          scopes_supported: ['openid'],
          claims_supported: ['sub', 'rolle', 'name', 'email', 'schule', 'klasse'],
        });
      }
      if (pfad === '/jwks') return json(200, { keys: [schluessel.jwk, ...(alt ? [alt.jwk] : [])] });

      if (pfad === '/authorize' && req.method === 'GET') {
        const p = Object.fromEntries(url.searchParams);
        const client = clients[p.client_id];
        if (!client || !client.weiterleitungen.includes(p.redirect_uri)) return seite(400, 'Anmeldung nicht möglich', '<p>Unbekannte Anwendung oder Rücksprungadresse.</p>');
        if (p.response_type !== 'code' || !String(p.scope).split(' ').includes('openid') || p.code_challenge_method !== 'S256' || !p.code_challenge) {
          return seite(400, 'Anmeldung nicht möglich', '<p>Die Anfrage entspricht nicht dem Verfahren (Code mit PKCE).</p>');
        }
        const versteckt = ['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge'].map((k) => `<input type="hidden" name="${k}" value="${esc(p[k] ?? '')}">`).join('');
        const knoepfe = TESTKONTEN.map((k, i) => `<button name="konto" value="${k.id}"${i > 1 ? ' class="leise"' : ''}>${esc(k.anzeige)}</button>`).join('');
        return seite(200, 'Mit Testkonto anmelden', `<form method="post" action="/attrappe/authorize">${versteckt}${knoepfe}</form><p class="hinweis">Diese Seite ersetzt in Tests den schulischen Anmeldedienst. Sie liefert Name und E-Mail mit, die die Anwendung nicht speichert.</p>`);
      }
      if (pfad === '/authorize' && req.method === 'POST') {
        const p = Object.fromEntries(new URLSearchParams(await koerper(req, 'text')));
        const client = clients[p.client_id];
        const konto = TESTKONTEN.find((k) => k.id === p.konto);
        if (!client || !client.weiterleitungen.includes(p.redirect_uri) || !konto) return seite(400, 'Anmeldung nicht möglich', '<p>Ungültige Auswahl.</p>');
        const code = b64url(randomBytes(24));
        codes.set(code, { client: p.client_id, weiter: p.redirect_uri, konto, nonce: p.nonce, herausforderung: p.code_challenge, bis: jetzt() + 60_000 });
        const ziel = new URL(p.redirect_uri);
        ziel.searchParams.set('code', code);
        if (p.state) ziel.searchParams.set('state', p.state);
        return sende(302, { Location: ziel.toString() }, '');
      }
      if (pfad === '/token' && req.method === 'POST') {
        const p = Object.fromEntries(new URLSearchParams(await koerper(req, 'text')));
        const [id, geheim] = Buffer.from(String(req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString().split(':').map(decodeURIComponent);
        const client = clients[id];
        if (!client || client.geheimnis !== geheim) return json(401, { error: 'invalid_client' });
        const c = codes.get(p.code);
        codes.delete(p.code);
        if (!c || c.client !== id || c.weiter !== p.redirect_uri || c.bis < jetzt()) return json(400, { error: 'invalid_grant' });
        const pruef = b64url(createHash('sha256').update(String(p.code_verifier ?? '')).digest());
        if (pruef !== c.herausforderung) return json(400, { error: 'invalid_grant', error_description: 'PKCE stimmt nicht' });
        const zugang = b64url(randomBytes(24));
        tokens.set(zugang, { konto: c.konto, bis: jetzt() + 300_000 });
        return json(200, { access_token: zugang, token_type: 'Bearer', expires_in: 300, id_token: idToken(c.konto, id, c.nonce) });
      }
      if (pfad === '/userinfo') {
        const t = tokens.get(String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
        if (!t || t.bis < jetzt()) return json(401, { error: 'invalid_token' });
        return json(200, t.konto.merkmale);
      }
      if (pfad === '/abmelden') {
        const zurueck = url.searchParams.get('post_logout_redirect_uri');
        const client = clients[url.searchParams.get('client_id')];
        if (zurueck && client?.abmeldeZiele?.includes(zurueck)) return sende(302, { Location: zurueck }, '');
        return seite(200, 'Abgemeldet', '<p>Sie sind beim Anmeldedienst abgemeldet.</p>');
      }
      return json(404, { fehler: 'Unbekannter Pfad der Attrappe' });
    },
  };
}
