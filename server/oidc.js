// Anmeldung über einen OpenID-Connect-Anbieter (Authorization Code Flow mit PKCE), ohne Fremdbibliothek.
// Vorbereitet für den schulischen Anmeldedienst; getestet gegen die Attrappe in server/attrappe.js.
//
// Was mit den gelieferten Merkmalen passiert, steht in docs/ANMELDUNG.md (Merkmalstabelle). Kurz: Gelesen werden
// nur `sub` und das Rollenmerkmal. Für Lehrkräfte bleibt ein HMAC von Aussteller und `sub`; für Lernende bleibt
// nichts. Namen, E-Mail-Adressen und alle übrigen Merkmale werden weder gespeichert noch protokolliert.

import { createHash, createPublicKey, verify, randomBytes } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const json64 = (teil) => JSON.parse(Buffer.from(teil, 'base64url').toString('utf8'));

export class AnmeldeFehler extends Error {
  constructor(art, meldung) { super(meldung); this.art = art; }
}

/**
 * `cfg`: { aussteller, clientId, clientSecret, rueckkehrUrl, rollenMerkmal, rollenLehrkraft, rollenLernende,
 *          intern (optional: Basis-URL für Server-zu-Server-Aufrufe), zeitlimitMs }
 */
export function oidcKlient(cfg, { abruf = globalThis.fetch } = {}) {
  let entdeckung = null;
  let entdecktAm = 0;
  let schluessel = null;

  const intern = (url) => (cfg.intern && url.startsWith(cfg.aussteller) ? cfg.intern + url.slice(cfg.aussteller.length) : url);

  async function hole(url, optionen = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), cfg.zeitlimitMs ?? 8000);
    try {
      const r = await abruf(intern(url), { ...optionen, signal: ac.signal });
      if (r.status >= 500) throw new AnmeldeFehler('nicht-erreichbar', `Anmeldedienst antwortet mit ${r.status}`);
      if (!r.ok) throw new AnmeldeFehler('anbieter', `Anmeldedienst antwortet mit ${r.status}`);
      return await r.json();
    } catch (e) {
      if (e instanceof AnmeldeFehler) throw e;
      throw new AnmeldeFehler('nicht-erreichbar', 'Der Anmeldedienst ist gerade nicht erreichbar.');
    } finally {
      clearTimeout(t);
    }
  }

  async function konfiguration() {
    if (entdeckung && Date.now() - entdecktAm < 3600_000) return entdeckung;
    const d = await hole(`${cfg.aussteller}/.well-known/openid-configuration`);
    if (d.issuer !== cfg.aussteller) throw new AnmeldeFehler('anbieter', 'Aussteller in der Konfiguration stimmt nicht');
    entdeckung = d;
    entdecktAm = Date.now();
    return d;
  }

  async function oeffentlicherSchluessel(kid, erneut = false) {
    if (!schluessel || erneut) schluessel = (await hole((await konfiguration()).jwks_uri)).keys ?? [];
    const jwk = schluessel.find((k) => k.kid === kid && (k.use ?? 'sig') === 'sig');
    if (jwk) return createPublicKey({ key: jwk, format: 'jwk' });
    if (!erneut) return oeffentlicherSchluessel(kid, true); // Schlüsselwechsel beim Anbieter: einmal neu laden
    throw new AnmeldeFehler('token', 'Signaturschlüssel des Anmeldedienstes unbekannt');
  }

  /** Prüft ein ID-Token und liefert seine Merkmale. */
  async function pruefeIdToken(idToken, nonce) {
    const teile = String(idToken).split('.');
    if (teile.length !== 3) throw new AnmeldeFehler('token', 'ID-Token hat nicht drei Teile');
    const kopf = json64(teile[0]);
    const daten = json64(teile[1]);
    if (kopf.alg !== 'RS256') throw new AnmeldeFehler('token', `Signaturverfahren ${kopf.alg} nicht erlaubt`);
    const ok = verify('RSA-SHA256', Buffer.from(`${teile[0]}.${teile[1]}`), await oeffentlicherSchluessel(kopf.kid), Buffer.from(teile[2], 'base64url'));
    if (!ok) throw new AnmeldeFehler('token', 'Signatur des ID-Tokens ungültig');
    const jetzt = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(daten.aud) ? daten.aud : [daten.aud];
    if (daten.iss !== cfg.aussteller) throw new AnmeldeFehler('token', 'Aussteller des ID-Tokens stimmt nicht');
    if (!aud.includes(cfg.clientId)) throw new AnmeldeFehler('token', 'ID-Token ist nicht für diese Anwendung');
    if (aud.length > 1 && daten.azp !== cfg.clientId) throw new AnmeldeFehler('token', 'azp stimmt nicht');
    if (!Number.isFinite(daten.exp) || daten.exp < jetzt - 60) throw new AnmeldeFehler('token', 'ID-Token abgelaufen');
    if (Number.isFinite(daten.iat) && daten.iat > jetzt + 120) throw new AnmeldeFehler('token', 'ID-Token aus der Zukunft');
    if (daten.nonce !== nonce) throw new AnmeldeFehler('token', 'nonce stimmt nicht');
    if (typeof daten.sub !== 'string' || !daten.sub) throw new AnmeldeFehler('merkmale', 'Merkmal sub fehlt');
    return daten;
  }

  /** Ordnet das Rollenmerkmal einer Rolle der App zu: 'lehrkraft', 'lernende' oder null. */
  function rolleAus(merkmale) {
    const roh = merkmale[cfg.rollenMerkmal ?? 'rolle'];
    const werte = (Array.isArray(roh) ? roh : [roh]).filter((w) => typeof w === 'string').map((w) => w.toLowerCase());
    if (werte.some((w) => (cfg.rollenLehrkraft ?? ['lehrkraft']).includes(w))) return 'lehrkraft';
    if (werte.some((w) => (cfg.rollenLernende ?? ['schueler', 'lernende']).includes(w))) return 'lernende';
    return null;
  }

  return {
    /** Beginnt eine Anmeldung. Liefert die Weiterleitungsadresse und die Werte, die bis zur Rückkehr bleiben. */
    async beginne() {
      const k = await konfiguration();
      const zustand = b64url(randomBytes(24));
      const nonce = b64url(randomBytes(24));
      const pruefcode = b64url(randomBytes(48));
      const herausforderung = b64url(createHash('sha256').update(pruefcode).digest());
      const url = new URL(k.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.rueckkehrUrl, scope: 'openid',
        state: zustand, nonce, code_challenge: herausforderung, code_challenge_method: 'S256',
      }).toString();
      return { url: url.toString(), zustand, nonce, pruefcode };
    },

    /** Schließt die Anmeldung ab: Code gegen Token tauschen, ID-Token prüfen, Rolle ableiten. */
    async schliesseAb({ code, nonce, pruefcode }) {
      const k = await konfiguration();
      const antwort = await hole(k.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.rueckkehrUrl, code_verifier: pruefcode }).toString(),
      });
      if (!antwort.id_token) throw new AnmeldeFehler('token', 'Keine ID-Token-Antwort');
      const merkmale = await pruefeIdToken(antwort.id_token, nonce);
      const rolle = rolleAus(merkmale);
      if (!rolle) throw new AnmeldeFehler('rolle', 'Ihre Rolle wurde vom Anmeldedienst nicht übermittelt oder ist für diese Anwendung nicht vorgesehen.');
      // Nur diese zwei Werte verlassen diese Funktion; alle anderen Merkmale werden hier verworfen.
      return { sub: merkmale.sub, rolle };
    },

    /** Adresse für die zentrale Abmeldung beim Anbieter, falls er sie anbietet. */
    async abmeldeUrl(zurueck) {
      try {
        const k = await konfiguration();
        if (!k.end_session_endpoint) return null;
        const url = new URL(k.end_session_endpoint);
        url.search = new URLSearchParams({ client_id: cfg.clientId, post_logout_redirect_uri: zurueck }).toString();
        return url.toString();
      } catch {
        return null; // Anbieter nicht erreichbar: lokal abgemeldet ist man trotzdem
      }
    },

    rolleAus,
    pruefeIdToken,
  };
}
