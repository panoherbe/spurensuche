// Einfache Collage nur für Tests der App: Sammelstücke im Raster oder Kreis, drei Regler, PNG 2048 und Vorschau.
export const regler = [
  { id: 'anordnung', name: 'Anordnung', werte: [{ id: 'raster', name: 'Raster' }, { id: 'kreis', name: 'Kreis' }] },
  { id: 'groesse', name: 'Größe', werte: [{ id: 'mittel', name: 'Mittel' }, { id: 'klein', name: 'Klein' }, { id: 'gross', name: 'Groß' }] },
  { id: 'farbstimmung', name: 'Farbstimmung', werte: [{ id: 'warm', name: 'Warm' }, { id: 'kalt', name: 'Kalt' }, { id: 'hell', name: 'Hell' }] },
];
const GRUND = { warm: '#f3d9b1', kalt: '#cfe2f3', hell: '#fbfbf7' };
const FAKTOR = { klein: 0.6, mittel: 0.8, gross: 1 };

function bild(src) {
  return new Promise((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = src; });
}

export async function erzeugeCollage(items, optionen = {}) {
  const k = optionen.kantenlaenge ?? 2048;
  const leinwand = document.createElement('canvas');
  leinwand.width = k; leinwand.height = k;
  const g = leinwand.getContext('2d');
  g.fillStyle = GRUND[optionen.farbstimmung] ?? GRUND.warm;
  g.fillRect(0, 0, k, k);
  const basis = new URL('../../', import.meta.url);
  const bilder = await Promise.all(items.map((i) => bild(new URL(i.bild, basis).href)));
  const n = bilder.length;
  const spalten = Math.ceil(Math.sqrt(n));
  const zelle = k / spalten;
  const groesse = zelle * (FAKTOR[optionen.groesse] ?? 0.8);
  bilder.forEach((b, i) => {
    let x; let y;
    if (optionen.anordnung === 'kreis' && n > 1) {
      const w = (i / n) * Math.PI * 2;
      x = k / 2 + Math.cos(w) * k * 0.3 - groesse / 2; y = k / 2 + Math.sin(w) * k * 0.3 - groesse / 2;
    } else { x = (i % spalten) * zelle + (zelle - groesse) / 2; y = Math.floor(i / spalten) * zelle + (zelle - groesse) / 2; }
    g.drawImage(b, x, y, groesse, groesse);
  });
  const png = await new Promise((ok) => leinwand.toBlob(ok, 'image/png'));
  const klein = document.createElement('canvas');
  klein.width = Math.min(512, k); klein.height = Math.min(512, k);
  klein.getContext('2d').drawImage(leinwand, 0, 0, klein.width, klein.height);
  let vorschau = await new Promise((ok) => klein.toBlob(ok, 'image/webp', 0.85));
  if (!vorschau || vorschau.type !== 'image/webp') vorschau = await new Promise((ok) => klein.toBlob(ok, 'image/jpeg', 0.85));
  return { png, vorschau, metadaten: { kennung: crypto.randomUUID(), erstellt: new Date().toISOString(), art: 'item-collage', items: items.map((i) => i.id) } };
}
