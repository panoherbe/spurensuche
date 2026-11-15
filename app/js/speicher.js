// Speicher im Gerät (IndexedDB): Einstellungen, Team, Fortschritt, Ausgang für die Übertragung, Bilder.
// Bleibt bei Abmeldung und Sitzungsende erhalten; gelöscht wird nur über „Daten auf diesem Gerät löschen“.

const NAME = 'spurensuche';
const VERSION = 1;
let offen = null;

function db() {
  if (!offen) {
    offen = new Promise((ok, fehler) => {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('werte')) d.createObjectStore('werte');
        if (!d.objectStoreNames.contains('ausgang')) d.createObjectStore('ausgang', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('bilder')) d.createObjectStore('bilder', { keyPath: 'kennung' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fehler(r.error);
    });
  }
  return offen;
}

function anfrage(speicher, modus, fn) {
  return db().then((d) => new Promise((ok, fehler) => {
    const t = d.transaction(speicher, modus);
    const r = fn(t.objectStore(speicher));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error);
  }));
}

export const lies = (schluessel) => anfrage('werte', 'readonly', (s) => s.get(schluessel));
export const schreibe = (schluessel, wert) => anfrage('werte', 'readwrite', (s) => s.put(wert, schluessel));
export const entferne = (schluessel) => anfrage('werte', 'readwrite', (s) => s.delete(schluessel));

export const legeInAusgang = (eintrag) => anfrage('ausgang', 'readwrite', (s) => s.add({ ...eintrag, angelegt: new Date().toISOString(), versuche: 0 }));
export const ausgang = () => anfrage('ausgang', 'readonly', (s) => s.getAll());
export const ausgangErledigt = (id) => anfrage('ausgang', 'readwrite', (s) => s.delete(id));
export const ausgangAktualisieren = (eintrag) => anfrage('ausgang', 'readwrite', (s) => s.put(eintrag));

export const speichereBild = (bild) => anfrage('bilder', 'readwrite', (s) => s.put(bild));
export const bild = (kennung) => anfrage('bilder', 'readonly', (s) => s.get(kennung));
export const bilder = () => anfrage('bilder', 'readonly', (s) => s.getAll());

/** Löscht alles, was diese Anwendung auf dem Gerät gespeichert hat (außer den Einstellungen, wenn gewünscht). */
export async function allesLoeschen({ einstellungenBehalten = true } = {}) {
  const e = einstellungenBehalten ? await lies('einstellungen') : null;
  await anfrage('werte', 'readwrite', (s) => s.clear());
  await anfrage('ausgang', 'readwrite', (s) => s.clear());
  await anfrage('bilder', 'readwrite', (s) => s.clear());
  if (e) await schreibe('einstellungen', e);
}

/** Bittet den Browser, die Daten nicht von selbst zu räumen (wichtig für vorgeladene Quests). */
export async function dauerhaftBitten() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
