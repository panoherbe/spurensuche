// Probe-Format nur für Tests der App (kein Teil der Inhalte): Frage mit Antworten, Hinweis, Rollen, Abstimmung.
export const meta = { id: 'probe', titel: 'Probefrage', dauerMinuten: [5, 10], offline: true };

export async function starte(wurzel, aufgabe, umgebung) {
  const t0 = performance.now();
  const ereignisse = [];
  const melde = (art, wert) => { const e = { art, zeit: Math.round(performance.now() - t0), wert }; ereignisse.push(e); umgebung.melde(e); };
  const text = (z) => z[umgebung.sprache] ?? z.standard;
  const el = (tag, attr = {}, ...kinder) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v); for (const k of kinder) e.append(k); return e; };

  const stil = el('link', { rel: 'stylesheet', href: new URL('./stil.css', import.meta.url).href });
  const geladen = new Promise((ok) => { stil.addEventListener('load', ok, { once: true }); stil.addEventListener('error', ok, { once: true }); });
  wurzel.append(stil);
  await geladen;

  const frage = el('h2', { 'data-vorlesen': '' }, text(aufgabe.text));
  const status = el('p', { class: 'probe-status', role: 'status' });
  const rollen = Array.isArray(umgebung.rollen) && umgebung.rollen.length ? umgebung.rollen : null;
  let rolle = rollen ? rollen[0] : null;
  const rollenWahl = rollen ? el('div', { class: 'probe-rollen', role: 'group', 'aria-label': 'Wer tippt gerade?' }) : null;
  if (rollen) for (const r of rollen) {
    const b = el('button', { type: 'button', class: 'knopf leise', 'aria-pressed': String(r === rolle) }, r);
    b.addEventListener('click', () => { rolle = r; for (const x of rollenWahl.children) x.setAttribute('aria-pressed', String(x === b)); });
    rollenWahl.append(b);
  }
  const antworten = el('div', { class: 'probe-antworten' });
  wurzel.append(frage, rollenWahl ?? '', antworten, status);

  let versuche = 0;
  let letzteFalsche = null;
  let wartetAufAnlauf = false;
  const hilfe = aufgabe.hinweis ? el('button', { type: 'button', class: 'knopf leise' }, 'Hinweis') : null;
  if (hilfe) { hilfe.addEventListener('click', () => { melde('hilfe', 1); status.textContent = text(aufgabe.hinweis); }); wurzel.append(hilfe); }

  return new Promise((fertig) => {
    const ende = (geloest, items) => {
      const weiter = el('button', { type: 'button', class: 'knopf gross' }, 'Weiter');
      wurzel.append(el('p', { 'data-vorlesen': '' }, geloest ? 'Geschafft!' : 'Beendet.'), weiter);
      weiter.addEventListener('click', () => fertig({ geloest, punkte: geloest ? 3 : 0, versuche, dauerSekunden: Math.round((performance.now() - t0) / 1000), items, ereignisse }));
      weiter.focus();
    };
    umgebung.signal.addEventListener('abort', () => fertig({ geloest: false, punkte: 0, versuche, dauerSekunden: Math.round((performance.now() - t0) / 1000), items: [], ereignisse }), { once: true });
    for (const a of aufgabe.antworten) {
      const b = el('button', { type: 'button', 'data-vorlesen': '', 'aria-pressed': 'false', 'data-antwort': a.id }, text(a.text));
      b.addEventListener('click', () => {
        if (rolle) melde('rolle', rolle);
        if (aufgabe.richtig === null) {
          melde('weg', a.id);
          for (const x of antworten.children) x.setAttribute('aria-pressed', String(x === b));
          if (aufgabe.abstimmung) {
            const einig = el('button', { type: 'button', class: 'knopf' }, 'Alle sind einverstanden');
            const mehrheit = el('button', { type: 'button', class: 'knopf leise' }, 'Die Mehrheit ist dafür');
            const waehle = (w) => { melde('abstimmung', w); melde('versuch', true); versuche++; ende(true, aufgabe.belohnung); };
            einig.addEventListener('click', () => waehle('einig'));
            mehrheit.addEventListener('click', () => waehle('mehrheit'));
            status.replaceChildren('Wie entscheidet ihr?', ' ', einig, ' ', mehrheit);
          } else { melde('versuch', true); versuche++; ende(true, aufgabe.belohnung); }
          return;
        }
        if (wartetAufAnlauf) { melde('neuer-anlauf', a.id !== letzteFalsche); wartetAufAnlauf = false; }
        versuche++;
        const richtig = a.id === aufgabe.richtig;
        melde('versuch', richtig);
        if (richtig) { status.textContent = 'Richtig!'; ende(true, aufgabe.belohnung); }
        else { status.textContent = 'Noch nicht. Versucht es noch einmal.'; letzteFalsche = a.id; wartetAufAnlauf = true; }
      });
      antworten.append(b);
    }
  });
}
