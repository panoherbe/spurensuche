// QR-Schilder für die Orte als druckfertiges PDF (A4, ein Schild je Seite): großer QR-Code, Name, Code zum
// Eintippen, kurze Anleitung. Erzeugt im Browser aus kern/qr.js und kern/pdf.js.

import { PdfDokument, textbreite } from './kern/pdf.js';
import { qrQuadrate } from './kern/qr.js';
import { qrAdresse } from './ortspruefung.js';

export function qrSchilder(orte, basisUrl, { jetzt = new Date() } = {}) {
  const pdf = new PdfDokument({ titel: 'QR-Schilder Spurensuche' });
  orte.forEach((ort, i) => {
    if (i > 0) pdf.neueSeite();
    const mitte = pdf.breite / 2;
    const zentriert = (text, y, opt) => pdf.text(mitte - textbreite(text, opt.groesse, opt.fett) / 2, y, text, opt);
    zentriert('Spurensuche Sachsen', 90, { groesse: 16, fett: true, farbe: '#1d6b47' });
    zentriert(ort.name, 130, { groesse: 30, fett: true });
    zentriert(ort.region, 158, { groesse: 14, farbe: '#4b5651' });
    const kante = 340;
    const links = mitte - kante / 2;
    const oben = 190;
    const { liste, modul } = qrQuadrate(qrAdresse(basisUrl, ort), links, oben, kante);
    pdf.rechteck(links - 6, oben - 6, kante + 12, kante + 12, { rand: '#1d6b47', staerke: 3 });
    pdf.quadrate(liste, modul + 0.05);
    zentriert('Code zum Eintippen:', oben + kante + 50, { groesse: 13, farbe: '#4b5651' });
    zentriert(ort.qr, oben + kante + 82, { groesse: 28, fett: true });
    zentriert('QR-Code in der Spurensuche scannen oder den Code eintippen.', oben + kante + 122, { groesse: 12 });
    zentriert('Der Standort wird dabei nicht gespeichert.', oben + kante + 140, { groesse: 11, farbe: '#4b5651' });
    pdf.text(pdf.rand, pdf.hoehe - 40, `Erstellt am ${jetzt.toLocaleDateString('de-DE')} · ${i + 1}/${orte.length}`, { groesse: 8, farbe: '#4b5651' });
  });
  return pdf.alsBytes({ erstellt: jetzt });
}
