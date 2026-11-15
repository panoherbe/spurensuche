// Service Worker: hält App, Spiele, Inhalte und Bilder vollständig im Gerät (Liste: offline-liste.json), damit
// Quests ohne Netz laufen. Die Schnittstelle (/api/…) geht nie über den Zwischenspeicher.

const PRAEFIX = 'spurensuche-';
const basis = () => self.registration.scope;
const IMMER = ['index.html', 'lehrkraefte.html', 'konfiguration.json', 'offline-liste.json', 'manifest.webmanifest'];

async function aktuelleVersion() {
  const namen = (await caches.keys()).filter((n) => n.startsWith(PRAEFIX));
  return namen.length ? namen.sort().at(-1).slice(PRAEFIX.length) : null;
}

/** Lädt alle Dateien der Liste in einen neuen Zwischenspeicher und räumt alte ab. */
async function vorladen() {
  const antwort = await fetch(new URL('offline-liste.json', basis()), { cache: 'no-store' });
  if (!antwort.ok) throw new Error(`offline-liste.json: ${antwort.status}`);
  const liste = await antwort.clone().json();
  if ((await aktuelleVersion()) === liste.version) return { neu: false, dateien: liste.dateien.length };
  const cache = await caches.open(PRAEFIX + liste.version);
  const pfade = [...new Set([...IMMER, ...liste.dateien.map((d) => d.pfad)])];
  // in kleinen Gruppen, damit langsame Schulnetze nicht an zu vielen gleichzeitigen Anfragen scheitern
  for (let i = 0; i < pfade.length; i += 8) {
    await Promise.all(pfade.slice(i, i + 8).map(async (p) => {
      const r = await fetch(new URL(p, basis()), { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${p}: ${r.status}`);
      await cache.put(new URL(p, basis()).href, r);
    }));
  }
  await cache.put(new URL('offline-liste.json', basis()).href, antwort);
  for (const n of await caches.keys()) if (n.startsWith(PRAEFIX) && n !== PRAEFIX + liste.version) await caches.delete(n);
  return { neu: true, dateien: pfade.length };
}

async function melde(daten) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(daten);
}

self.addEventListener('install', (ev) => {
  ev.waitUntil(vorladen().then((r) => melde({ art: 'vorgeladen', ...r })).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(self.clients.claim());
});

self.addEventListener('message', (ev) => {
  if (ev.data?.art === 'pruefen') ev.waitUntil(vorladen().then((r) => { if (r.neu) return melde({ art: 'vorgeladen', ...r }); }).catch(() => {}));
});

function istSchnittstelle(url) {
  const rel = url.href.slice(basis().length);
  return /^(api|anmeldung|attrappe)\//.test(rel);
}

self.addEventListener('fetch', (ev) => {
  const anfrage = ev.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(basis()) || istSchnittstelle(url)) return;

  if (anfrage.mode === 'navigate') {
    // Seiten: zuerst Netz (kurz), sonst aus dem Gerät
    ev.respondWith((async () => {
      const seite = url.pathname.endsWith('lehrkraefte.html') ? 'lehrkraefte.html' : url.pathname.endsWith('verwaltung.html') ? 'verwaltung.html' : 'index.html';
      try {
        const netz = await Promise.race([fetch(anfrage), new Promise((_, nein) => setTimeout(() => nein(new Error('langsam')), 3500))]);
        if (netz.ok) return netz;
        throw new Error(String(netz.status));
      } catch {
        return (await caches.match(new URL(seite, basis()).href)) ?? (await caches.match(new URL('index.html', basis()).href)) ?? Response.error();
      }
    })());
    return;
  }

  ev.respondWith((async () => {
    const gespeichert = await caches.match(anfrage, { ignoreSearch: true });
    if (gespeichert && !/(konfiguration|offline-liste)\.json$/.test(url.pathname)) return gespeichert;
    try {
      return await fetch(anfrage);
    } catch {
      return gespeichert ?? Response.error();
    }
  })());
});
