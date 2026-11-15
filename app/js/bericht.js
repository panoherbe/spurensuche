// Gruppenbericht als PDF (im Browser erzeugt, verlässt das Gerät nur, wenn die Lehrkraft ihn speichert):
// Stufen mit Beschreibung, Beobachtungen, Datum, Quest; keine Ziffernnote, keine Punktzahl.

import { PdfDokument } from './kern/pdf.js';
import { stufeName, BESCHREIBUNG } from './kern/raster.js';
import { datum } from './kern/zeit.js';

const GRUEN = '#1d6b47';
const GRAU = '#4b5651';

export function gruppenbericht({ auswertung, entwurf, jetzt = new Date() }) {
  const a = auswertung;
  const pdf = new PdfDokument({ titel: `Gruppenbericht ${a.gruppe.bezeichnung}` });
  const breite = pdf.nutzbreite;
  pdf.text(pdf.rand, pdf.y + 8, 'Spurensuche · Gruppenbericht', { groesse: 10, farbe: GRAU });
  pdf.y += 20;
  pdf.absatz(`Gruppe „${a.gruppe.bezeichnung}“`, { groesse: 20, fett: true, abstand: 2 });
  pdf.absatz(`Quest: ${a.quest}`, { groesse: 12, abstand: 2 });
  pdf.absatz(`Stand der Beobachtungen: ${datum(a.stand ?? jetzt.toISOString())} · Bericht erstellt am ${datum(jetzt.toISOString())}`, { groesse: 10, farbe: GRAU, abstand: 10 });

  pdf.rechteck(pdf.rand, pdf.y, breite, 46, { fuellung: '#dde8f3' });
  pdf.text(pdf.rand + 10, pdf.y + 17, 'Beobachtungsgrundlage, keine Bewertung: ohne Noten, ohne Punkte, ohne Rangfolge.', { groesse: 10, fett: true });
  pdf.text(pdf.rand + 10, pdf.y + 33, 'Alle Angaben gelten für die Gruppe, nicht für einzelne Schülerinnen und Schüler.', { groesse: 10 });
  pdf.y += 62;

  pdf.absatz('Kompetenzraster', { groesse: 14, fett: true, farbe: GRUEN, abstand: 4 });
  for (const z of a.raster.zeilen) {
    pdf.platz(70);
    const stufe = z.stufe ? `Stufe „${stufeName(z.stufe)}“${z.einschaetzung ? ' (Einschätzung der Lehrkraft)' : ' (Vorschlag aus den Beobachtungen)'}` : 'noch keine Beobachtung';
    pdf.absatz(`${z.name}: ${stufe}`, { groesse: 11, fett: true, abstand: 2 });
    if (z.stufe) pdf.absatz(BESCHREIBUNG[z.bereich][z.stufe], { groesse: 10.5, abstand: 2, einzug: 12 });
    const belege = z.zellen.find((c) => c.stufe === z.stufe)?.belege ?? [];
    if (belege.length) pdf.absatz(`Beobachtet: ${belege.slice(0, 4).join('; ')}${belege.length > 4 ? ' …' : ''}`, { groesse: 9.5, farbe: GRAU, abstand: 8, einzug: 12 });
    else pdf.y += 6;
  }

  pdf.absatz('Beobachtungen', { groesse: 14, fett: true, farbe: GRUEN, abstand: 4 });
  const b = a.beobachtungen;
  for (const [titel, saetze] of [['Teamleistung', b.teamleistung.saetze], ['Problemlösung', b.problemloesung.saetze], ['Beteiligung', b.beteiligung.saetze], ['Zeit', [b.kontext.satz]]]) {
    pdf.platz(40);
    pdf.absatz(titel, { groesse: 11, fett: true, abstand: 1 });
    for (const s of saetze) pdf.absatz(`• ${s}`, { groesse: 10.5, abstand: 1, einzug: 10 });
    pdf.y += 5;
  }

  if (entwurf?.trim()) {
    pdf.platz(80);
    pdf.absatz('Formulierungsentwurf (ENTWURF, von der Lehrkraft bearbeitet)', { groesse: 14, fett: true, farbe: GRUEN, abstand: 4 });
    pdf.absatz(entwurf, { groesse: 10.5, abstand: 8 });
  }

  pdf.platz(40);
  pdf.linie(pdf.rand, pdf.y + 4, pdf.rand + breite, pdf.y + 4, { farbe: '#cfc7b6' });
  pdf.y += 10;
  pdf.absatz('Dieser Bericht verbleibt in der Verantwortung der Lehrkraft. Die Daten der Gruppe in der Anwendung werden automatisch gelöscht'
    + (a.loeschenAm ? ` (spätestens am ${datum(a.loeschenAm)}).` : '.'), { groesse: 9, farbe: GRAU });
  return pdf.alsBytes({ erstellt: jetzt });
}
