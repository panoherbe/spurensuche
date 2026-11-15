// Sitzungen, Codes, Kopfzeilen und Bremsen. Gespeichert werden nur Hashes von Tokens, nie die Tokens selbst.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'spur_sitzung';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I

export const hash = (text) => createHash('sha256').update(String(text)).digest('hex');
export const hmac = (schluessel, text) => createHmac('sha256', schluessel).update(String(text)).digest('hex');
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const kennung = () => randomBytes(12).toString('base64url');

/** Lesbarer Code wie „K7QH-M3PZ“. */
export function code(laenge = 8) {
  const b = randomBytes(laenge);
  let s = '';
  for (let i = 0; i < laenge; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${s.slice(0, laenge / 2)}-${s.slice(laenge / 2)}`;
}

export function normalisiereCode(eingabe) {
  const s = String(eingabe ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function gleich(a, b) {
  const x = Buffer.from(hash(String(a)));
  const y = Buffer.from(hash(String(b)));
  return timingSafeEqual(x, y);
}

export function leseCookies(kopf = '') {
  const aus = {};
  for (const teil of String(kopf).split(';')) {
    const i = teil.indexOf('=');
    if (i > 0) {
      try { aus[teil.slice(0, i).trim()] = decodeURIComponent(teil.slice(i + 1).trim()); } catch { /* kaputtes Cookie überspringen */ }
    }
  }
  return aus;
}

export function cookieKopf(wert, maxAlterSek, sicher, name = COOKIE, sameSite = 'Strict') {
  return `${name}=${wert}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAlterSek}${sicher ? '; Secure' : ''}`;
}

/**
 * Bremse gegen das Durchprobieren von Codes und Schlüsseln: höchstens `max` Fehlversuche je Absender und Minute.
 * Eine ganze Schule hinter einer gemeinsamen Adresse kann trotzdem gleichzeitig beitreten, weil nur Fehlschläge
 * zählen. Die Absenderadresse liegt nur im Arbeitsspeicher und nur für die laufende Minute.
 */
export function bremse(max = 20) {
  const fenster = new Map();
  let laufend = Math.floor(Date.now() / 60000);
  // Mit jeder neuen Minute vergisst die Bremse alle Absender: beim nächsten Zugriff und, ohne weitere Anfragen,
  // spätestens zehn Sekunden nach dem Minutenwechsel (der Zeitgeber hält den Prozess nicht am Leben).
  const vergiss = () => {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== laufend) { fenster.clear(); laufend = minute; }
  };
  setInterval(vergiss, 10000).unref?.();
  const eintrag = (schluessel) => {
    vergiss();
    let e = fenster.get(schluessel);
    if (!e) {
      if (fenster.size > 10000) fenster.clear();
      e = { n: 0 };
      fenster.set(schluessel, e);
    }
    return e;
  };
  return {
    erlaubt: (schluessel) => eintrag(schluessel).n < max,
    fehlschlag: (schluessel) => { eintrag(schluessel).n++; },
  };
}

/** Strenge Inhaltsrichtlinie: nur eigene Skripte und Stile, keine eingebetteten Fremdinhalte. */
export function kopfzeilen({ formularZiele = [] } = {}) {
  const ziele = ["'self'", ...formularZiele].join(' ');
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action ${ziele}`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

// SVG-Bilder dürfen eigene Stilangaben enthalten. Als Bild eingebunden laufen darin nie Skripte; öffnet jemand die
// Datei direkt, verbietet diese Richtlinie trotzdem jedes Skript und jedes Nachladen.
export const SVG_RICHTLINIE = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
