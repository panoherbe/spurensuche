// Ortsprüfung im Gerät: QR-Code (Kamera), Code vom Schild eintippen oder GPS. Gespeichert und übertragen wird
// nur das Ergebnis („vor Ort, per QR/Code/GPS“). Kamerabilder und Koordinaten verlassen diese Datei nicht.

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function codePasst(ort, eingabe) {
  return norm(eingabe).length >= 4 && norm(eingabe) === norm(ort.qr);
}

/** Inhalt eines QR-Codes: Adresse mit `code=` oder nur der Code. Liefert `{ ort, code }`. */
export function leseQrInhalt(text) {
  const roh = String(text ?? '').trim();
  try {
    const u = new URL(roh);
    const hash = u.hash.replace(/^#\/?/, '');
    const [pfad, abfrage = ''] = hash.split('?');
    const teile = pfad.split('/');
    const code = new URLSearchParams(abfrage).get('code') ?? u.searchParams.get('code');
    return { ort: teile[0] === 'ort' ? teile[1] : null, code };
  } catch {
    return { ort: null, code: roh };
  }
}

/** Adresse, die auf dem QR-Schild eines Orts steht. */
export function qrAdresse(basisUrl, ort) {
  const u = new URL(basisUrl);
  u.hash = `/ort/${ort.id}?code=${encodeURIComponent(ort.qr)}`;
  return u.toString();
}

export const kannScannen = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

/**
 * Scannt mit der Kamera, bis ein QR-Code erkannt ist oder `signal` abbricht. Das Videobild bleibt im Gerät.
 */
export async function scanne(video, signal) {
  const erkenner = new window.BarcodeDetector({ formats: ['qr_code'] });
  const strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  const stopp = () => { for (const spur of strom.getTracks()) spur.stop(); video.srcObject = null; };
  signal?.addEventListener('abort', stopp, { once: true });
  try {
    video.srcObject = strom;
    video.setAttribute('playsinline', '');
    video.muted = true;
    await video.play();
    while (!signal?.aborted) {
      const treffer = await erkenner.detect(video).catch(() => []);
      if (treffer.length) return treffer[0].rawValue;
      await new Promise((ok) => setTimeout(ok, 200));
    }
    throw new DOMException('Abgebrochen', 'AbortError');
  } finally {
    stopp();
  }
}

function entfernung(a, b) {
  const r = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/**
 * Prüft per GPS, ob das Gerät im Radius des Orts ist. Liefert `{ ok, grund }`; die Position selbst wird nach dem
 * Vergleich verworfen und nie gespeichert.
 */
export function pruefeStandort(ort) {
  return new Promise((ok) => {
    if (!navigator.geolocation) { ok({ ok: false, grund: 'Dieses Gerät kann den Standort nicht bestimmen. Bitte den Code vom Schild eintippen.' }); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const radius = ort.lage.radius ?? 150;
      const ungenau = pos.coords.accuracy > Math.max(250, radius * 2);
      const m = entfernung({ lat: pos.coords.latitude, lon: pos.coords.longitude }, ort.lage);
      if (m <= radius + Math.min(pos.coords.accuracy, 100)) ok({ ok: true });
      else if (ungenau) ok({ ok: false, grund: 'Der Standort ist gerade zu ungenau. Bitte den QR-Code scannen oder den Code eintippen.' });
      else ok({ ok: false, grund: `Ihr seid noch etwa ${m >= 1000 ? `${Math.round(m / 100) / 10} km` : `${Math.round(m / 10) * 10} m`} entfernt.` });
    }, (fehler) => {
      ok({ ok: false, grund: fehler.code === 1 ? 'Der Standort ist nicht freigegeben. Ihr könnt auch den Code vom Schild eintippen.' : 'Der Standort ließ sich nicht bestimmen. Bitte den Code vom Schild eintippen.' });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}
