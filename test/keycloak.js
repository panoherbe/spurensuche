// Gegenprobe der Anmeldung gegen Keycloak (compose.keycloak.yaml): derselbe Ablauf wie im Browser, mit fetch und
// Cookies: Anmeldung startet bei der Spurensuche, Anmeldeformular von Keycloak, Rücksprung, Prüfung des ID-Tokens,
// Rolle aus den Realm-Rollen, Abmeldung. Danach Suche in der Datenbankdatei nach Name, E-Mail und Pseudonym.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'http://localhost:8080';
const KC = 'http://localhost:8180/realms/schule';
const AUSGABE = process.env.AUSGABE ?? 'nachweis/tmp';
mkdirSync(AUSGABE, { recursive: true });
const ergebnis = { zeitpunkt: new Date().toISOString(), anbieter: `Keycloak ${process.env.KEYCLOAK_VERSION ?? '?'} (start-dev, Realm „schule“, Testkonten)`, faelle: [], fehler: [] };

function browser() {
  const cookies = new Map(); // je Host
  const kopf = (url) => { const c = cookies.get(new URL(url).host); return c?.size ? { Cookie: [...c].map(([n, w]) => `${n}=${w}`).join('; ') } : {}; };
  return async function anfrage(url, { methode = 'GET', form, json } = {}) {
    const typ = form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : json ? { 'Content-Type': 'application/json' } : {};
    const body = form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined;
    const r = await fetch(url, { method: methode, redirect: 'manual', headers: { ...kopf(url), ...typ }, body });
    const host = new URL(url).host;
    if (!cookies.has(host)) cookies.set(host, new Map());
    for (const c of r.headers.getSetCookie()) {
      const [paar] = c.split(';');
      const i = paar.indexOf('=');
      const name = paar.slice(0, i).trim();
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) cookies.get(host).delete(name); else cookies.get(host).set(name, paar.slice(i + 1));
    }
    return { status: r.status, ort: r.headers.get('location'), text: await r.text() };
  };
}

async function warteAuf(url, sekunden = 180) {
  for (let i = 0; i < sekunden; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} nicht erreichbar`);
}

/** Anmeldung im Namen eines Testkontos; liefert die Zieladresse nach dem Rücksprung und den Browser. */
async function anmelden(benutzer, passwort) {
  const b = browser();
  const start = await b(`${APP}/anmeldung/start`);
  if (start.status !== 302 || !start.ort.startsWith(KC)) throw new Error(`Start leitet nicht zu Keycloak: ${start.status} ${start.ort}`);
  const auth = new URL(start.ort);
  const seite = await b(start.ort);
  const aktion = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/.exec(seite.text)?.[1]?.replace(/&amp;/g, '&');
  if (!aktion) throw new Error('Anmeldeformular von Keycloak nicht gefunden');
  const antwort = await b(aktion, { methode: 'POST', form: { username: benutzer, password: passwort, credentialId: '' } });
  if (antwort.status !== 302 || !antwort.ort?.startsWith(`${APP}/anmeldung/rueckkehr`)) throw new Error(`Keycloak leitet nicht zurück: ${antwort.status} ${antwort.ort ?? antwort.text.slice(0, 200)}`);
  const rueck = await b(antwort.ort);
  return { b, ziel: rueck.ort, pkce: auth.searchParams.get('code_challenge_method'), status: rueck.status };
}

async function fall(name, fn) {
  try { const daten = await fn(); ergebnis.faelle.push({ name, ok: true, ...daten }); console.log(`✓ ${name}`); } catch (e) { ergebnis.faelle.push({ name, ok: false, fehler: e.message }); ergebnis.fehler.push(`${name}: ${e.message}`); console.log(`✗ ${name}: ${e.message}`); }
}

await warteAuf(`${KC}/.well-known/openid-configuration`);
await warteAuf(`${APP}/api/v1/status`);

await fall('Lehrkraft meldet sich an (Rolle aus Realm-Rolle)', async () => {
  const { b, ziel, pkce } = await anmelden('lehrkraft.test', 'Test-Lehrkraft-1');
  if (ziel !== '/lehrkraefte.html') throw new Error(`Ziel ${ziel}`);
  const ich = JSON.parse((await b(`${APP}/api/v1/ich`)).text);
  if (ich.rolle !== 'lehrkraft') throw new Error(`Rolle ${ich.rolle}`);
  const lg = await b(`${APP}/api/v1/lerngruppen`);
  if (lg.status !== 200) throw new Error(`Lerngruppen ${lg.status}`);
  return { pkce, ziel };
});

await fall('Abmeldung lokal und Weiterleitung zur zentralen Abmeldung von Keycloak', async () => {
  const { b } = await anmelden('lehrkraft.test', 'Test-Lehrkraft-1');
  const ab = JSON.parse((await b(`${APP}/api/v1/abmeldung`, { methode: 'POST', json: {} })).text);
  const weiter = new URL(ab.weiter);
  if (!ab.weiter.startsWith(`${KC}/protocol/openid-connect/logout`) || weiter.searchParams.get('client_id') !== 'spurensuche') throw new Error(`weiter ${ab.weiter}`);
  const danach = JSON.parse((await b(`${APP}/api/v1/ich`)).text);
  if (danach.rolle !== null) throw new Error('Sitzung nach Abmeldung noch gültig');
  const kc = await b(ab.weiter);
  if (![200, 302].includes(kc.status)) throw new Error(`Keycloak-Abmeldung ${kc.status}`);
  return { weiter: `${weiter.origin}${weiter.pathname}`, keycloakStatus: kc.status };
});

await fall('Schülerin/Schüler: Sitzung ohne Bezug zur Person, weiter zum Beitritt', async () => {
  const { b, ziel } = await anmelden('schueler.test', 'Test-Schueler-1');
  if (ziel !== '/#/beitritt') throw new Error(`Ziel ${ziel}`);
  const ich = JSON.parse((await b(`${APP}/api/v1/ich`)).text);
  if (ich.rolle !== 'lernende') throw new Error(`Rolle ${ich.rolle}`);
  return { ziel };
});

await fall('Konto ohne passende Rolle wird mit verständlicher Meldung abgewiesen', async () => {
  const { ziel } = await anmelden('ohne.rolle', 'Test-Ohne-1');
  if (!/fehler=rolle/.test(ziel)) throw new Error(`Ziel ${ziel}`);
  return { ziel };
});

await fall('Name, E-Mail und Pseudonym aus Keycloak stehen nicht in der Datenbank', async () => {
  const dateien = readdirSync('/daten').filter((n) => n.startsWith('spurensuche.db'));
  const inhalt = dateien.map((n) => readFileSync(join('/daten', n)).toString('latin1')).join('\n');
  const verboten = ['Erika', 'Beispiel', 'erika.beispiel@schule.test', 'Kim', 'kim.muster@schule.test', 'lehrkraft.test', 'schueler.test'];
  const gefunden = verboten.filter((w) => inhalt.includes(w));
  if (gefunden.length) throw new Error(`gefunden: ${gefunden.join(', ')}`);
  return { geprueft: dateien, woerter: verboten.length };
});

writeFileSync(join(AUSGABE, 'keycloak.json'), JSON.stringify(ergebnis, null, 2));
console.log(ergebnis.fehler.length ? `${ergebnis.fehler.length} Fehler` : 'Keine Fehler.');
process.exit(ergebnis.fehler.length ? 1 : 0);
