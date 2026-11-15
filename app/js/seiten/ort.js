// Ein Ort: Bild, Text, Ortsprüfung (QR, Code, GPS) oder ortsunabhängige Fassung, danach die Aufgaben.

import { h, leere, knopf, symbol, dialog, melde, frage } from '../ui.js';
import { t } from '../einstellungen.js';
import { url, aufgabenVon } from '../inhalte.js';
import { aktuellesTeam, orteDesTeams, stationVon, beginneStation, brichStationAb } from '../spielstand.js';
import { codePasst, leseQrInhalt, kannScannen, scanne, pruefeStandort } from '../ortspruefung.js';
import { bald } from '../sync.js';

const VERIFIKATION = { qr: 'vor Ort, QR-Code gescannt', code: 'vor Ort, Code eingetippt', gps: 'vor Ort, Standort bestätigt', ersatz: 'ortsunabhängig gespielt' };

export async function zeige(ctx) {
  const { haupt, inhalte, teile, params, navigiere, neuZeichnen } = ctx;
  const team = aktuellesTeam();
  const eintrag = orteDesTeams(inhalte).find((x) => x.ort.id === teile[0]);
  if (!eintrag) {
    leere(haupt, h('h1', {}, 'Diesen Ort gibt es in eurer Quest nicht'), h('p', {}, h('a', { href: '#/karte' }, 'Zur Karte')));
    return 'Ort nicht gefunden';
  }
  const { ort } = eintrag;
  const aufgaben = await aufgabenVon(ort, eintrag.aufgaben);

  // Vom QR-Schild geöffnet (…#/ort/<id>?code=…): sofort prüfen
  const codeAusLink = params.get('code');
  if (codeAusLink && !stationVon(ort.id)) {
    if (codePasst(ort, codeAusLink)) { await beginneStation(ort.id, 'qr'); bald(); melde('Station erreicht: Ihr seid vor Ort.'); }
    else melde('Dieser Code passt nicht zu diesem Ort.');
    location.replace(`#/ort/${ort.id}`);
    return ort.name;
  }

  const station = stationVon(ort.id);
  const minuten = aufgaben.reduce((s, a) => s + (a.dauerMinuten ?? 0), 0);
  const bestaetigt = async (art) => {
    await beginneStation(ort.id, art);
    bald();
    melde(art === 'ersatz' ? 'Ihr spielt diesen Ort im Klassenzimmer.' : 'Station erreicht: Ihr seid vor Ort.');
    neuZeichnen();
  };

  const pruefBereich = station ? null : h('section', { class: 'karte', 'aria-labelledby': 'pruef-titel' },
    h('h2', { id: 'pruef-titel', 'data-vorlesen': '' }, t({ standard: 'Seid ihr vor Ort?', einfach: 'Seid ihr an diesem Ort?' })),
    h('div', { class: 'pruefwahl' },
      kannScannen() ? knopf('QR-Code scannen', () => qrDialog(ort, bestaetigt), { art: 'gross', sym: 'qr' }) : null,
      knopf('Code vom Schild eintippen', () => codeDialog(ort, bestaetigt), { art: kannScannen() ? 'zweit gross' : 'gross', sym: 'tastatur' }),
      knopf('Standort prüfen', async (ev) => {
        const k = ev.currentTarget;
        k.setAttribute('aria-busy', 'true');
        k.disabled = true;
        const r = await pruefeStandort(ort);
        k.disabled = false;
        k.removeAttribute('aria-busy');
        if (r.ok) bestaetigt('gps'); else melde(r.grund, { dauer: 6000 });
      }, { art: 'zweit gross', sym: 'standort' })),
    h('p', { class: 'leise' }, 'Der Standort wird nur im Gerät verglichen und nicht gespeichert.'),
    h('h2', { 'data-vorlesen': '' }, t({ standard: 'Nicht vor Ort?', einfach: 'Ihr seid nicht dort?' })),
    h('p', { 'data-vorlesen': '' }, t({ standard: 'Alle Aufgaben gehen auch im Klassenzimmer. Ihr bekommt dann Bilder und Texte zum Ort.', einfach: 'Ihr könnt auch in der Schule spielen. Dann seht ihr Bilder vom Ort.' })),
    knopf('Im Klassenzimmer spielen', () => bestaetigt('ersatz'), { art: 'leise', sym: 'schule' }));

  const ersatz = station?.verifikation === 'ersatz' ? h('section', { class: 'karte' },
    h('h2', { 'data-vorlesen': '' }, t({ standard: 'So sieht es dort aus', einfach: 'So ist es dort' })),
    ort.ersatz.bild ? h('img', { class: 'ortsbild', src: url(ort.ersatz.bild), alt: ort.ersatz.alt ?? '' }) : null,
    h('p', { class: 'ortstext', 'data-vorlesen': '' }, t(ort.ersatz.text))) : null;

  const naechste = aufgaben.find((a) => !team.laeufe[a.kennung]);
  const liste = station ? h('section', { 'aria-labelledby': 'aufgaben-titel' },
    h('h2', { id: 'aufgaben-titel' }, `Aufgaben (${aufgaben.length}, etwa ${minuten} Minuten)`),
    h('ol', { class: 'aufgabenliste' }, aufgaben.map((a, i) => {
      const fertig = !!team.laeufe[a.kennung];
      return h('li', { class: `aufgabe-zeile${fertig ? ' fertig' : ''}` },
        h('span', { class: 'nr', 'aria-hidden': 'true' }, fertig ? symbol('haken') : String(i + 1)),
        h('span', { class: 'text' }, h('strong', {}, a.titel), h('span', { class: 'leise' }, `${a.dauerMinuten} Minuten${fertig ? ' · erledigt' : ''}`)),
        h('a', { class: `knopf${fertig ? ' leise' : ''}`, href: `#/aufgabe/${a.kennung}`, 'aria-label': `${fertig ? 'Noch einmal spielen' : 'Starten'}: ${a.titel}` }, fertig ? 'Noch einmal' : 'Starten'));
    })),
    h('div', { class: 'knopfreihe', stil: { 'margin-top': '16px' } },
      naechste ? h('a', { class: 'knopf gross', href: `#/aufgabe/${naechste.kennung}` }, symbol('weiter'), naechste === aufgaben[0] ? 'Los geht’s' : 'Weiter mit der nächsten Aufgabe')
        : h('a', { class: 'knopf gross', href: '#/karte' }, symbol('karte'), 'Ort geschafft – zur Karte'),
      station.status !== 'abgeschlossen' && naechste !== aufgaben[0] ? knopf('Station verlassen', async () => {
        if (await frage('Station verlassen?', 'Ihr könnt später weitermachen. Die Lehrkraft sieht die Station als unterbrochen.', { ja: 'Verlassen' })) {
          await brichStationAb(ort.id);
          bald();
          navigiere('/karte');
        }
      }, { art: 'leise' }) : null)) : null;

  leere(haupt,
    h('p', {}, h('a', { href: '#/karte' }, '← Karte')),
    h('img', { class: 'ortsbild', src: url(ort.bild), alt: ort.alt }),
    h('div', { class: 'seitenkopf' }, h('div', {},
      h('h1', { 'data-vorlesen': '' }, ort.name),
      h('p', { class: 'leise' }, ort.region, ort.id === inhalte.finale ? ' · Abschluss der Reise' : '')),
      station ? h('span', { class: 'marke gut' }, symbol('haken'), VERIFIKATION[station.verifikation] ?? 'begonnen') : null),
    h('p', { class: 'ortstext', 'data-vorlesen': '' }, t(ort.text)),
    h('p', { class: 'leise' }, `Bild: ${ort.bildQuelle}`),
    pruefBereich, ersatz, liste);
  return ort.name;
}

function codeDialog(ort, bestaetigt) {
  return dialog('Code vom Schild', (inhalt, schliesse) => {
    const feld = h('input', { id: 'ortcode', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '20', 'aria-describedby': 'ortcode-hilfe' });
    const fehler = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: true });
    inhalt.append(h('form', { onsubmit: (ev) => {
      ev.preventDefault();
      if (codePasst(ort, feld.value)) { schliesse(true); bestaetigt('code'); } else { fehler.textContent = 'Der Code passt nicht. Steht er klein unter dem QR-Code?'; fehler.hidden = false; feld.focus(); }
    } },
    h('div', { class: 'feld' }, h('label', { for: 'ortcode' }, 'Code'), feld, h('p', { class: 'erklaerung', id: 'ortcode-hilfe' }, 'Der Code steht klein unter dem QR-Code auf dem Schild.')),
    fehler, knopf('Prüfen', null, { typ: 'submit' })));
    setTimeout(() => feld.focus(), 50);
  });
}

function qrDialog(ort, bestaetigt) {
  const abbruch = new AbortController();
  return dialog('QR-Code scannen', (inhalt, schliesse) => {
    const video = h('video', { class: 'ortsbild', 'aria-label': 'Kamerabild zum Scannen', muted: true });
    const status = h('p', { role: 'status' }, 'Haltet die Kamera auf den QR-Code am Schild.');
    inhalt.append(video, status, knopf('Abbrechen', () => { abbruch.abort(); schliesse(null); }, { art: 'leise' }));
    scanne(video, abbruch.signal).then((text) => {
      const { ort: ortId, code } = leseQrInhalt(text);
      if ((ortId === null || ortId === ort.id) && codePasst(ort, code)) { schliesse(true); bestaetigt('qr'); }
      else { status.textContent = ortId && ortId !== ort.id ? 'Das ist der QR-Code eines anderen Orts.' : 'Dieser QR-Code gehört nicht zur Spurensuche.'; }
    }).catch((e) => {
      if (e.name !== 'AbortError') status.textContent = 'Die Kamera ließ sich nicht öffnen. Bitte den Code eintippen.';
    });
  }).finally(() => abbruch.abort());
}
