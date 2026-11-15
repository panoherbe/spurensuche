// Item-Collage: der Bildbeitrag aus den gesammelten Sammelstücken, regelbasiert, ohne generative KI (Schnittstelle 5).
//
//   const { png, vorschau, metadaten } = await erzeugeCollage(items, { anordnung, groesse, farbstimmung });
//
// png: Blob image/png, 2048 × 2048 px (mit optionen.kantenlaenge kleiner, nur für die schnelle Vorschau beim Einstellen);
// vorschau: Blob image/webp (sonst image/jpeg), höchstens 512 × 512 px; metadaten: { kennung, erstellt, art, items }.
// Das Bild enthält keinen Namen, keine Gruppenbezeichnung und keinen Text über die Gruppe; unten rechts steht nur die
// Art des Bildes („Item-Collage“). Läuft im Browser ohne Netz (Canvas); die Sticker kommen aus assets/spiele/items/.

import { REGLER, STIMMUNGEN, anordnen, einstellungen } from './regeln.js';
import { zufallsquelle, hash } from '../_gemeinsam/zufall.js';

export const regler = REGLER;
export const KANTENLAENGE = 2048;
const WURZEL_URL = new URL('../../', import.meta.url);

function leinwand(kante) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = kante;
    c.height = kante;
    return c;
  }
  return new OffscreenCanvas(kante, kante);
}

function alsBlob(canvas, typ, qualitaet) {
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: typ, quality: qualitaet });
  return new Promise((ok, fehler) => canvas.toBlob((blob) => (blob ? ok(blob) : fehler(new Error('Das Bild ließ sich nicht speichern.'))), typ, qualitaet));
}

const bilder = new Map();
function ladeBild(src) {
  if (!bilder.has(src)) {
    bilder.set(src, new Promise((ok, fehler) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => fehler(new Error(`Sammelstück-Bild fehlt: ${src}`));
      img.src = src;
    }));
  }
  return bilder.get(src);
}

function kennung() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function rundesRechteck(ctx, x, y, b, h, r, neuerPfad = true) {
  if (neuerPfad) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b, y, x + b, y + h, r);
  ctx.arcTo(x + b, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + b, y, r);
  ctx.closePath();
}

function zeichneHintergrund(ctx, k, s, startwert) {
  const verlauf = ctx.createLinearGradient(0, 0, 0, k);
  s.verlauf.forEach((farbe, i) => verlauf.addColorStop(i / (s.verlauf.length - 1), farbe));
  ctx.fillStyle = verlauf;
  ctx.fillRect(0, 0, k, k);
  const zufall = zufallsquelle(startwert);
  ctx.save();
  if (s.muster === 'sterne') {
    ctx.fillStyle = s.musterFarbe;
    for (let i = 0; i < 140; i++) {
      const r = (0.0012 + zufall() * 0.0028) * k;
      ctx.globalAlpha = 0.45 + zufall() * 0.55;
      ctx.beginPath(); ctx.arc(zufall() * k, zufall() * k, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0.2 * k, 0.17 * k, 0.07 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = verlauf; // gleicher Verlauf wie der Himmel: Aus dem Kreis wird eine Sichel
    ctx.beginPath(); ctx.arc(0.23 * k, 0.155 * k, 0.062 * k, 0, Math.PI * 2); ctx.fill();
  } else if (s.muster === 'sonne') {
    ctx.fillStyle = s.musterFarbe;
    ctx.strokeStyle = s.musterFarbe;
    ctx.lineWidth = 0.012 * k;
    ctx.lineCap = 'round';
    const [sx, sy, sr] = [0.82 * k, 0.17 * k, 0.085 * k];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3); ctx.lineTo(sx + Math.cos(a) * sr * 1.75, sy + Math.sin(a) * sr * 1.75); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9CCB7B';
    ctx.beginPath(); ctx.moveTo(0, 0.86 * k);
    ctx.bezierCurveTo(0.25 * k, 0.78 * k, 0.45 * k, 0.9 * k, 0.7 * k, 0.83 * k);
    ctx.bezierCurveTo(0.85 * k, 0.79 * k, 0.95 * k, 0.82 * k, k, 0.8 * k);
    ctx.lineTo(k, k); ctx.lineTo(0, k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7DB860';
    ctx.beginPath(); ctx.moveTo(0, 0.93 * k);
    ctx.bezierCurveTo(0.3 * k, 0.86 * k, 0.6 * k, 0.97 * k, k, 0.9 * k);
    ctx.lineTo(k, k); ctx.lineTo(0, k); ctx.closePath(); ctx.fill();
  } else if (s.muster === 'wolken') {
    ctx.fillStyle = s.musterFarbe;
    for (let i = 0; i < 7; i++) {
      const x = zufall() * k;
      const y = (0.08 + zufall() * 0.8) * k;
      const b = (0.12 + zufall() * 0.12) * k;
      for (const [dx, dy, f] of [[0, 0, 1], [-0.45, 0.12, 0.7], [0.45, 0.12, 0.75]]) {
        ctx.beginPath(); ctx.ellipse(x + dx * b, y + dy * b, b * 0.55 * f, b * 0.32 * f, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (s.muster === 'huegel') {
    ctx.fillStyle = 'rgba(255, 214, 140, 0.9)';
    ctx.beginPath(); ctx.arc(0.5 * k, 0.8 * k, 0.16 * k, 0, Math.PI * 2); ctx.fill();
    for (const [hoehe, farbe] of [[0.78, 'rgba(70,45,90,0.55)'], [0.86, 'rgba(45,30,70,0.7)'], [0.93, 'rgba(30,20,50,0.85)']]) {
      ctx.fillStyle = farbe;
      ctx.beginPath(); ctx.moveTo(0, hoehe * k);
      for (let x = 0; x <= 1.0001; x += 0.125) ctx.quadraticCurveTo((x + 0.0625) * k, (hoehe - 0.04 - zufall() * 0.04) * k, (x + 0.125) * k, hoehe * k);
      ctx.lineTo(k, k); ctx.lineTo(0, k); ctx.closePath(); ctx.fill();
    }
  } else if (s.muster === 'schichten') {
    ctx.strokeStyle = s.musterFarbe;
    ctx.lineWidth = 0.006 * k;
    for (let y = 0.06; y < 1; y += 0.055 + zufall() * 0.03) {
      ctx.beginPath(); ctx.moveTo(0, y * k);
      for (let x = 0; x < 1; x += 0.1) ctx.quadraticCurveTo((x + 0.05) * k, (y + (zufall() - 0.5) * 0.02) * k, (x + 0.1) * k, y * k);
      ctx.stroke();
    }
  }
  // weiches Licht hinter den Stickern
  const licht = ctx.createRadialGradient(0.5 * k, 0.5 * k, 0.05 * k, 0.5 * k, 0.5 * k, 0.6 * k);
  licht.addColorStop(0, 'rgba(255,255,255,0.32)');
  licht.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = licht;
  ctx.fillRect(0, 0, k, k);
  ctx.restore();
}

function zeichneSticker(ctx, k, bild, platz) {
  const groesse = platz.groesse * k;
  ctx.save();
  ctx.translate(platz.x * k, platz.y * k);
  ctx.rotate((platz.drehung * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 0.014 * k;
  ctx.shadowOffsetY = 0.006 * k;
  ctx.drawImage(bild, -groesse / 2, -groesse / 2, groesse, groesse);
  ctx.restore();
}

function zeichneRahmen(ctx, k, s) {
  // Rahmen: Fläche außen, Inhalt in einem abgerundeten Fenster
  ctx.save();
  ctx.fillStyle = s.rahmen;
  ctx.beginPath();
  ctx.rect(0, 0, k, k);
  rundesRechteck(ctx, 0.028 * k, 0.028 * k, 0.944 * k, 0.944 * k, 0.05 * k, false);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(38, 50, 56, 0.25)';
  ctx.lineWidth = 0.003 * k;
  rundesRechteck(ctx, 0.028 * k, 0.028 * k, 0.944 * k, 0.944 * k, 0.05 * k);
  ctx.stroke();
  // Art des Bildes, klein unten rechts (kein Text über die Gruppe)
  const text = 'Item-Collage';
  ctx.font = `600 ${Math.round(0.022 * k)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const breite = ctx.measureText(text).width + 0.03 * k;
  const hoehe = 0.04 * k;
  const x = 0.944 * k - breite;
  const y = 0.944 * k - hoehe;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  rundesRechteck(ctx, x, y, breite, hoehe, hoehe / 2);
  ctx.fill();
  ctx.fillStyle = '#263238';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 0.015 * k, y + hoehe / 2 + 0.001 * k);
  ctx.restore();
}

/**
 * Erzeugt die Item-Collage. items: Einträge aus inhalte/items.json (oder nur Kennungen), 1 bis 12.
 * optionen: { anordnung, groesse, farbstimmung } nach `regler`; optional kantenlaenge für eine schnelle Vorschau.
 */
export async function erzeugeCollage(items, optionen = {}) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 12) throw new Error('erzeugeCollage: Bitte 1 bis 12 Sammelstücke wählen.');
  const o = einstellungen(optionen);
  const kante = Math.min(KANTENLAENGE, Math.max(128, Math.round(Number(optionen.kantenlaenge) || KANTENLAENGE)));
  const liste = items.map((item) => (typeof item === 'string' ? { id: item, bild: `assets/spiele/items/${item}.svg` } : item));
  const plaetze = anordnen(liste.map((i) => i.id), o);
  const geladen = new Map(await Promise.all(liste.map(async (i) => [i.id, await ladeBild(new URL(i.bild, WURZEL_URL).href)])));
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load(`600 20px "Atkinson Hyperlegible Next"`); } catch { /* Systemschrift genügt */ }
  }

  const canvas = leinwand(kante);
  const ctx = canvas.getContext('2d');
  const stimmung = STIMMUNGEN[o.farbstimmung];
  zeichneHintergrund(ctx, kante, stimmung, hash(`${o.farbstimmung}|${liste.length}`));
  for (const platz of plaetze) zeichneSticker(ctx, kante, geladen.get(platz.id), platz);
  zeichneRahmen(ctx, kante, stimmung);

  const png = await alsBlob(canvas, 'image/png');
  const vk = Math.min(512, kante);
  const klein = leinwand(vk);
  const kctx = klein.getContext('2d');
  kctx.imageSmoothingQuality = 'high';
  kctx.drawImage(canvas, 0, 0, vk, vk);
  let vorschau = await alsBlob(klein, 'image/webp', 0.86);
  if (vorschau.type !== 'image/webp') vorschau = await alsBlob(klein, 'image/jpeg', 0.88);

  return {
    png,
    vorschau,
    metadaten: { kennung: kennung(), erstellt: new Date().toISOString(), art: 'item-collage', items: plaetze.map((p) => p.id) },
  };
}
