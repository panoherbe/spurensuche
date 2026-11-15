// Bildbeitrag nach der Abschlussaufgabe: Sammelstücke wählen, Regler einstellen, Collage erzeugen (Modul
// spiele/collage), speichern, freigeben. Schulgruppen: Freigabe durch die Lehrkraft. Familien: durch sich selbst.

import { h, leere, knopf, symbol, melde, herunterladen, frage } from '../ui.js';
import { t } from '../einstellungen.js';
import { url } from '../inhalte.js';
import { aktuellesTeam, finaleGeschafft, setzeBild, istSchule } from '../spielstand.js';
import { speichereBild, bild as ladeBild, legeInAusgang } from '../speicher.js';
import { datumZeit } from '../kern/zeit.js';
import { bald } from '../sync.js';

const STATUS = {
  lokal: 'nur auf diesem Gerät',
  wartet: 'wird übertragen',
  gesendet: 'bei der Lehrkraft; sie entscheidet über die Ausstellung',
  freigegeben: 'für die Ausstellung freigegeben',
};

export async function zeige(ctx) {
  const { haupt, inhalte, neuZeichnen } = ctx;
  const team = aktuellesTeam();
  const finale = inhalte.ortNach.get(inhalte.finale);
  if (!finaleGeschafft(inhalte)) {
    leere(haupt, h('h1', { 'data-vorlesen': '' }, 'Euer Bild'),
      h('p', { 'data-vorlesen': '' }, t({
        standard: `Aus euren Sammelstücken entsteht am Ende ein eigenes Bild. Es öffnet sich, wenn ihr die Abschlussaufgabe am Ort „${finale?.name ?? 'Finale'}“ geschafft habt.`,
        einfach: `Am Ende macht ihr ein Bild aus euren Sammelstücken. Dafür spielt ihr zuerst die letzte Aufgabe bei „${finale?.name ?? 'Finale'}“.`,
      })),
      finale ? h('a', { class: 'knopf', href: `#/ort/${finale.id}` }, symbol('ort'), `Zu ${finale.name}`) : null);
    return 'Euer Bild';
  }

  if (team.bild) {
    const b = await ladeBild(team.bild.kennung);
    if (b) return zeigeFertig(ctx, b, team);
  }

  let modul;
  try { modul = await import(url('spiele/collage/index.js')); } catch { modul = null; }
  if (!modul?.erzeugeCollage) {
    leere(haupt, h('h1', {}, 'Euer Bild'), h('p', {}, 'Die Collage kommt mit dem nächsten Stand der Spiele.'));
    return 'Euer Bild';
  }

  const gesammelt = inhalte.items.filter((i) => team.items.includes(i.id));
  const gewaehlt = new Set(gesammelt.slice(0, 12).map((i) => i.id));
  const regler = Array.isArray(modul.regler) ? modul.regler : [];
  const optionen = Object.fromEntries(regler.map((r) => [r.id, r.werte?.[0]?.id]));
  const vorschau = h('div', { class: 'vorschau-rahmen', role: 'img', 'aria-label': 'Vorschau eures Bildes' });
  const status = h('p', { class: 'leise', role: 'status' });
  let laufendeVorschau = 0;

  async function aktualisiere() {
    const nr = ++laufendeVorschau;
    const items = gesammelt.filter((i) => gewaehlt.has(i.id));
    if (!items.length) { leere(vorschau, h('p', { class: 'leise' }, 'Wählt mindestens ein Sammelstück.')); return; }
    status.textContent = 'Vorschau wird gezeichnet …';
    try {
      const r = await modul.erzeugeCollage(items, { ...optionen, kantenlaenge: 512 });
      if (nr !== laufendeVorschau) return;
      const blob = r.vorschau ?? r.png;
      const img = h('img', { src: URL.createObjectURL(blob), alt: `Vorschau: Collage aus ${items.map((i) => i.name).join(', ')}` });
      leere(vorschau, img);
      status.textContent = `${items.length} ${items.length === 1 ? 'Sammelstück' : 'Sammelstücke'} im Bild.`;
    } catch (e) {
      console.error(e);
      status.textContent = 'Die Vorschau ließ sich nicht zeichnen.';
    }
  }

  const auswahl = h('fieldset', {}, h('legend', {}, `Sammelstücke fürs Bild (höchstens 12)`), h('div', { class: 'itemwahl' }, gesammelt.map((i) => {
    const id = `item-${i.id}`;
    return [h('input', { type: 'checkbox', id, checked: gewaehlt.has(i.id), onchange: (ev) => {
      if (ev.target.checked && gewaehlt.size >= 12) { ev.target.checked = false; melde('Höchstens 12 Sammelstücke.'); return; }
      if (ev.target.checked) gewaehlt.add(i.id); else gewaehlt.delete(i.id);
      aktualisiere();
    } }), h('label', { for: id }, h('img', { src: url(i.bild), alt: '' }), i.name)];
  })));
  const reglerFelder = regler.map((r) => h('fieldset', {}, h('legend', {}, r.name), h('div', { class: 'wahl' }, (r.werte ?? []).map((w, k) => {
    const id = `regler-${r.id}-${w.id}`;
    return [h('input', { type: 'radio', name: `regler-${r.id}`, id, checked: k === 0, onchange: () => { optionen[r.id] = w.id; aktualisiere(); } }), h('label', { for: id }, w.name)];
  }))));

  const fertig = knopf('Bild fertigstellen', async (ev) => {
    const items = gesammelt.filter((i) => gewaehlt.has(i.id));
    if (!items.length) return;
    ev.currentTarget.disabled = true;
    status.textContent = 'Euer Bild wird in voller Größe gezeichnet …';
    try {
      const r = await modul.erzeugeCollage(items, { ...optionen });
      const eintrag = { kennung: r.metadaten.kennung, png: r.png, vorschau: r.vorschau, metadaten: r.metadaten };
      await speichereBild(eintrag);
      await setzeBild({ kennung: r.metadaten.kennung, erstellt: r.metadaten.erstellt, status: 'lokal' });
      if (istSchule()) {
        await legeInAusgang({ art: 'bild', kennung: r.metadaten.kennung, mitToken: true });
        await setzeBild({ ...aktuellesTeam().bild, status: 'wartet' });
        bald();
      }
      neuZeichnen();
    } catch (e) {
      console.error(e);
      status.textContent = 'Das Bild ließ sich nicht erzeugen. Bitte noch einmal versuchen.';
      ev.currentTarget.disabled = false;
    }
  }, { art: 'gross', sym: 'bild' });

  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Euer Bild für die Ausstellung'),
    h('p', { 'data-vorlesen': '' }, t({
      standard: 'Wählt Sammelstücke und stellt Anordnung, Größe und Farbstimmung ein. Das Bild enthält keine Namen.',
      einfach: 'Sucht Dinge aus. Stellt ein, wie das Bild aussehen soll. Im Bild stehen keine Namen.',
    })),
    h('div', { class: 'bild-bereich' },
      h('div', {}, vorschau, status),
      h('div', {}, auswahl, reglerFelder, h('div', { class: 'knopfreihe' }, fertig))));
  aktualisiere();
  return 'Euer Bild';
}

function zeigeFertig({ haupt, neuZeichnen }, b, team) {
  const bildUrl = URL.createObjectURL(b.png);
  const familie = !istSchule();
  const freigeben = familie && team.bild.status === 'lokal' ? h('form', { class: 'karte', onsubmit: async (ev) => {
    ev.preventDefault();
    if (!ev.target.querySelector('#zustimmung').checked) { melde('Bitte zuerst zustimmen.'); return; }
    await legeInAusgang({ art: 'bild', kennung: b.kennung, mitToken: false, freigabe: true });
    await setzeBild({ ...team.bild, status: 'wartet' });
    bald();
    melde('Danke! Euer Bild wird übertragen, sobald Netz da ist.');
    neuZeichnen();
  } },
  h('h2', {}, 'Für die Ausstellung freigeben?'),
  h('label', { class: 'schalter' }, h('input', { type: 'checkbox', id: 'zustimmung' }), 'Wir sind einverstanden, dass unser Bild in der Ausstellung gezeigt wird. Es enthält keinen Namen und keinen Teamnamen.'),
  h('div', { class: 'knopfreihe' }, knopf('Freigeben', null, { typ: 'submit', sym: 'haken' }))) : null;

  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Euer Bild'),
    h('div', { class: 'bild-bereich' },
      h('div', { class: 'vorschau-rahmen' }, h('img', { src: bildUrl, alt: `Collage aus ${b.metadaten.items.length} Sammelstücken` })),
      h('div', {},
        h('p', { class: `hinweisfeld${team.bild.status === 'freigegeben' ? ' gut' : ''}`, role: 'status' }, `Stand: ${STATUS[team.bild.status] ?? team.bild.status}.`),
        h('dl', {},
          h('dt', {}, 'Erstellt'), h('dd', {}, datumZeit(b.metadaten.erstellt)),
          h('dt', {}, 'Art'), h('dd', {}, 'Item-Collage (ohne KI, nach festen Regeln)'),
          h('dt', {}, 'Format'), h('dd', {}, 'PNG, 2048 × 2048 Pixel'),
          h('dt', {}, 'Kennung'), h('dd', { class: 'leise' }, b.metadaten.kennung)),
        h('div', { class: 'knopfreihe' },
          knopf('Bild speichern', () => herunterladen(b.png, `spurensuche-bild-${b.metadaten.erstellt.slice(0, 10)}.png`, 'image/png'), { art: 'zweit', sym: 'herunter' }),
          team.bild.status === 'lokal' ? knopf('Neu gestalten', async () => {
            if (await frage('Neu gestalten?', 'Das bisherige Bild wird ersetzt.', { ja: 'Neu gestalten' })) { await setzeBild(null); neuZeichnen(); }
          }, { art: 'leise' }) : null),
        freigeben)));
  return 'Euer Bild';
}
