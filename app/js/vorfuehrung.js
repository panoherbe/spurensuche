// Vorführung ohne Server: dieselben Aufrufe wie HttpApi, nachgebildet im Browser (IndexedDB). Für die statische
// Seite (tools/statisch-bauen.js). Beispieldaten: eine Klasse 6 mit vier Gruppen, deren Spiele simuliert sind;
// die Gruppe mit dem Code DEMO-2026 ist leer und gehört dem Besuch, der sie in der Spieler-Ansicht spielt.
// Die Regeln (Bereinigung, Auswertung, Fristen) kommen aus denselben Kern-Modulen wie auf dem Server.

import { lies, schreibe, bild as ladeBild } from './speicher.js';
import { ladeInhalte, aufgabenVon } from './inhalte.js';
import { bereinigeEreignisse } from './kern/ereignisse.js';
import { beobachtungen, kompetenzraster, formulierungsentwurf } from './kern/raster.js';
import { pruefeBezeichnung } from './kern/namen.js';
import { loeschtermin, schuljahresende, datum } from './kern/zeit.js';
import { ApiFehler } from './api.js';

const SCHLUESSEL = 'vorfuehrung';
const STAND = 2;
const DEMO_CODE = 'DEMO-2026';
const jetzt = () => new Date().toISOString();
const id = () => crypto.randomUUID().slice(0, 12);

function zufall(saat) {
  let s = saat >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Simulierte Spielverläufe je Gruppe, nach festem Startwert (gleich bei jedem Aufruf). */
async function beispieldaten() {
  const inhalte = await ladeInhalte();
  const orte = [];
  for (const ort of inhalte.orte) orte.push({ ort: ort.id, aufgaben: ort.aufgaben, liste: await aufgabenVon(ort).catch(() => []) });
  const basis = Date.now() - 3 * 3600_000;
  const lg = { id: 'lg-beispiel', bezeichnung: 'Klasse 6a (Beispiel)', klassenstufe: 6, einwilligungAm: new Date(basis - 86400_000 * 3).toISOString(), erstellt: new Date(basis - 86400_000 * 7).toISOString() };
  lg.loeschenAm = schuljahresende(lg.erstellt);
  const quest = { id: 'quest-beispiel', lerngruppeId: lg.id, titel: 'Projekttag: Spurensuche Sachsen', zeitrahmen: 'projekttag', orte: orte.map(({ ort, aufgaben }) => ({ ort, aufgaben })), erfassung: true, rueckmeldung: true, erstellt: new Date(basis).toISOString(), beendet: null };
  quest.loeschenAm = loeschtermin({ begonnen: quest.erstellt });
  const profile = [
    { name: 'Biber', code: 'BIBR-4821', orte: orte.length, fehler: 0.2, hilfen: 0.15, wechsel: 0.85, einig: 0.8, saat: 11 },
    { name: 'Fuchs', code: 'FUCH-7310', orte: Math.max(1, orte.length - 1), fehler: 0.55, hilfen: 0.5, wechsel: 0.4, einig: 0.35, saat: 23 },
    { name: 'Luchs', code: 'LUCH-2954', orte: 1, fehler: 0.35, hilfen: 0.3, wechsel: 0.6, einig: 0.6, saat: 37, offen: true },
    { name: 'Eule', code: DEMO_CODE, orte: 0, saat: 41 },
  ];
  const d = { stand: STAND, angemeldet: false, lerngruppen: [lg], freigaben: [quest], gruppen: [], stationen: [], laeufe: [], technik: [], rueckmeldungen: [], bildbeitraege: [], eingang: [] };
  for (const p of profile) {
    const g = { id: `g-${p.name.toLowerCase()}`, freigabeId: quest.id, bezeichnung: p.name, code: p.code, einschaetzung: null, erstellt: quest.erstellt, letzteSync: null };
    d.gruppen.push(g);
    const r = zufall(p.saat);
    let t = basis + 10 * 60_000;
    for (const o of orte.slice(0, p.orte)) {
      const beginn = t;
      const laufListe = p.offen ? o.liste.slice(0, 1) : o.liste;
      for (const a of laufListe) {
        const ereignisse = [];
        let zeit = 20_000;
        const ev = (art, wert) => { ereignisse.push({ art, zeit, wert }); zeit += 15_000 + Math.round(r() * 30_000); };
        const rollen = Array.isArray(a.rollen) ? a.rollen : [];
        if (r() < p.hilfen) ev('hilfe', 1);
        if (a.stufe === 'beurteilen') {
          const wege = ['weg-a', 'weg-b', 'weg-c'].slice(0, 2 + Math.round(r()));
          for (const w of wege) { if (rollen.length) ev('rolle', rollen[Math.floor(r() * rollen.length)]); ev('weg', w); }
          ev('abstimmung', r() < p.einig ? 'einig' : 'mehrheit');
          ev('versuch', true);
        } else {
          const fehlversuche = r() < p.fehler ? 1 + Math.round(r()) : 0;
          for (let i = 0; i < fehlversuche; i++) {
            if (rollen.length) ev('rolle', rollen[Math.floor(r() * rollen.length)]);
            ev('versuch', false);
            ev('neuer-anlauf', r() < p.wechsel);
          }
          for (const rolle of rollen) if (r() < 0.8) ev('rolle', rolle);
          ev('versuch', true);
        }
        const dauer = Math.round(zeit / 1000);
        t += dauer * 1000 + 60_000;
        d.laeufe.push({ id: crypto.randomUUID(), gruppeId: g.id, aufgabe: `${o.ort}/${a.nr}`, geloest: true, versuche: ereignisse.filter((e) => e.art === 'versuch').length, dauerSekunden: dauer, items: a.belohnung ?? [], ereignisse, beendet: new Date(t).toISOString() });
      }
      const fertig = laufListe.length === o.liste.length;
      d.stationen.push({ gruppeId: g.id, ort: o.ort, status: fertig ? 'abgeschlossen' : 'begonnen', verifikation: r() < 0.5 ? 'qr' : 'ersatz', begonnen: new Date(beginn).toISOString(), beendet: fertig ? new Date(t).toISOString() : null, aktivSekunden: Math.round((t - beginn) / 1000 * 0.85) });
      t += 15 * 60_000;
    }
    if (p.orte) {
      d.technik.push({ gruppeId: g.id, schluessel: `${g.id}-off`, art: 'offline', zeit: new Date(basis + 40 * 60_000).toISOString() }, { gruppeId: g.id, schluessel: `${g.id}-sync`, art: 'sync', zeit: new Date(t).toISOString() });
      g.letzteSync = new Date(Math.min(t, Date.now() - 5 * 60_000)).toISOString();
    }
  }
  return d;
}

export class VorfuehrApi {
  constructor(konfiguration) {
    this.konfiguration = { ...konfiguration, anmeldung: { anmeldedienst: false, zugangsschluessel: false, attrappe: false } };
    this.vorfuehrung = true;
    this.zustand = null;
  }

  // Bei jedem Aufruf frisch aus dem Gerät lesen: Spieler- und Lehrkräfte-Ansicht laufen in getrennten Fenstern
  // und sehen so dieselben Daten (wie zwei Geräte an einem Server).
  async daten() {
    const gespeichert = await lies(SCHLUESSEL).catch(() => null);
    if (gespeichert?.stand === STAND) this.zustand = gespeichert;
    else {
      this.zustand = await beispieldaten();
      await this.speichern();
    }
    return this.zustand;
  }
  async speichern() { await schreibe(SCHLUESSEL, this.zustand).catch(() => {}); }
  fehler(status, meldung, daten) { return new ApiFehler(status, meldung, daten); }

  // --- Geräte ---
  async beitritt(code) {
    const d = await this.daten();
    const c = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const g = d.gruppen.find((x) => x.code.replace('-', '') === c);
    if (!g) throw this.fehler(404, 'Diesen Code gibt es nicht. In der Vorführung: DEMO-2026.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    return { token: `vorf-${g.id}`, gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: f.id, titel: f.titel, orte: f.orte, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung } };
  }
  async geraet(token) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => `vorf-${x.id}` === token);
    if (!g) throw this.fehler(410, 'Diese Gruppe gibt es nicht mehr.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    return { gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: f.id, titel: f.titel, orte: f.orte, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung, beendet: f.beendet } };
  }
  async sync(token, k) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => `vorf-${x.id}` === token);
    if (!g) throw this.fehler(410, 'Diese Gruppe gibt es nicht mehr.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    if (!f.erfassung) return { erfasst: false, erfassung: false };
    if (d.eingang.includes(k.schluessel)) return { erfasst: true, erfassung: true, doppelt: true };
    d.eingang.push(k.schluessel);
    const inhalte = await ladeInhalte();
    for (const s of k.stationen ?? []) {
      const alt = d.stationen.find((x) => x.gruppeId === g.id && x.ort === s.ort);
      if (alt) {
        alt.status = alt.status === 'abgeschlossen' ? 'abgeschlossen' : s.status;
        alt.verifikation = s.verifikation ?? alt.verifikation;
        alt.beendet = s.beendet ?? alt.beendet;
        alt.aktivSekunden = Math.max(alt.aktivSekunden, s.aktivSekunden ?? 0);
      } else d.stationen.push({ gruppeId: g.id, ort: s.ort, status: s.status, verifikation: s.verifikation ?? null, begonnen: s.begonnen, beendet: s.beendet ?? null, aktivSekunden: s.aktivSekunden ?? 0 });
    }
    for (const l of k.laeufe ?? []) {
      if (d.laeufe.some((x) => x.id === l.id)) continue;
      const [ort] = l.aufgabe.split('/');
      const ortDaten = inhalte.ortNach.get(ort);
      const aufgabe = ortDaten ? (await aufgabenVon(ortDaten)).find((a) => a.kennung === l.aufgabe) : null;
      const { ereignisse } = bereinigeEreignisse(l.ereignisse ?? [], { aufgabe });
      d.laeufe.push({ id: l.id, gruppeId: g.id, aufgabe: l.aufgabe, geloest: !!l.geloest, versuche: ereignisse.filter((e) => e.art === 'versuch').length, dauerSekunden: l.dauerSekunden ?? 0, items: (l.items ?? []).filter((i) => aufgabe?.belohnung?.includes(i)), ereignisse, beendet: l.beendet });
    }
    for (const t of k.technik ?? []) if (!d.technik.some((x) => x.gruppeId === g.id && x.schluessel === t.schluessel)) d.technik.push({ gruppeId: g.id, ...t });
    for (const r of k.rueckmeldungen ?? []) if (!d.rueckmeldungen.some((x) => x.id === r.id)) d.rueckmeldungen.push({ ...r, freigabeId: f.id, zeit: jetzt() });
    d.technik.push({ gruppeId: g.id, schluessel: `sync-${k.schluessel}`, art: 'sync', zeit: jetzt() });
    g.letzteSync = jetzt();
    await this.speichern();
    return { erfasst: true, erfassung: true, doppelt: false };
  }
  async bildbeitrag(daten, token) {
    const d = await this.daten();
    const g = token ? d.gruppen.find((x) => `vorf-${x.id}` === token) : null;
    const m = daten.metadaten;
    if (!d.bildbeitraege.some((b) => b.kennung === m.kennung)) {
      d.bildbeitraege.push({ kennung: m.kennung, gruppeId: g?.id ?? null, herkunft: g ? 'schule' : 'familie', art: m.art, items: m.items, erstellt: m.erstellt, status: g ? 'wartet' : 'freigegeben', entschieden: g ? null : jetzt() });
      await this.speichern();
    }
    return { kennung: m.kennung, status: g ? 'wartet' : 'freigegeben' };
  }

  // --- Anmeldung ---
  async ich() { const d = await this.daten(); return { rolle: d.angemeldet ? 'lehrkraft' : null, ueberAnmeldedienst: false }; }
  async anmeldenMitSchluessel() { const d = await this.daten(); d.angemeldet = true; await this.speichern(); return { rolle: 'lehrkraft' }; }
  async abmelden() { const d = await this.daten(); d.angemeldet = false; await this.speichern(); return { abgemeldet: true, weiter: null }; }
  anmeldedienstUrl() { return '#'; }

  // --- Lehrkräfte ---
  erfassungFuer(lg) {
    if (!(lg.klassenstufe >= 4 && lg.klassenstufe <= 8)) return { erfassung: false, grund: 'Diese Lerngruppe gehört nicht zu den Klassenstufen 4 bis 8. Die Gruppen spielen ohne Auswertung; es entstehen keine Beobachtungsdaten.' };
    if (!lg.einwilligungAm) return { erfassung: false, grund: 'Die Einwilligungen der Erziehungsberechtigten sind noch nicht bestätigt. Bis dahin entstehen keine Beobachtungsdaten.' };
    return { erfassung: true, grund: 'Beobachtungen werden auf Gruppenebene erfasst.' };
  }
  async lerngruppen() {
    const d = await this.daten();
    return d.lerngruppen.map((lg) => ({
      ...lg, kernzielgruppe: lg.klassenstufe >= 4 && lg.klassenstufe <= 8, erfassung: this.erfassungFuer(lg),
      freigaben: d.freigaben.filter((f) => f.lerngruppeId === lg.id).map((f) => ({ id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschenAm, erfassung: f.erfassung, gruppen: d.gruppen.filter((g) => g.freigabeId === f.id).length })),
    }));
  }
  async lerngruppeAnlegen(k) {
    const d = await this.daten();
    const name = String(k.bezeichnung ?? '').trim();
    if (name.length < 2) throw this.fehler(400, 'Bezeichnung: 2 bis 40 Zeichen, z. B. „Klasse 6a“');
    const lg = { id: id(), bezeichnung: name, klassenstufe: k.klassenstufe ?? null, einwilligungAm: k.einwilligung ? jetzt() : null, erstellt: jetzt() };
    lg.loeschenAm = schuljahresende(lg.erstellt);
    d.lerngruppen.unshift(lg);
    await this.speichern();
    return { id: lg.id };
  }
  async lerngruppeAendern(lgId, k) {
    const d = await this.daten();
    const lg = d.lerngruppen.find((x) => x.id === lgId);
    if ('bezeichnung' in k) lg.bezeichnung = String(k.bezeichnung).trim();
    if ('klassenstufe' in k) lg.klassenstufe = k.klassenstufe;
    if ('einwilligung' in k) lg.einwilligungAm = k.einwilligung ? (lg.einwilligungAm ?? jetzt()) : null;
    const e = this.erfassungFuer(lg);
    for (const f of d.freigaben.filter((x) => x.lerngruppeId === lgId && !x.beendet)) f.erfassung = e.erfassung;
    await this.speichern();
    return { ok: true, erfassung: e };
  }
  async lerngruppeLoeschen(lgId) {
    const d = await this.daten();
    for (const f of d.freigaben.filter((x) => x.lerngruppeId === lgId)) await this.questLoeschen(f.id, false);
    d.lerngruppen = d.lerngruppen.filter((x) => x.id !== lgId);
    await this.speichern();
    return { geloescht: true };
  }
  async questFreigeben(lgId, k) {
    const d = await this.daten();
    const lg = d.lerngruppen.find((x) => x.id === lgId);
    if (!k.orte?.length) throw this.fehler(400, 'Bitte 1 bis 15 Orte wählen');
    const f = { id: id(), lerngruppeId: lgId, titel: String(k.titel ?? '').trim() || 'Quest', zeitrahmen: k.zeitrahmen ?? 'eigen', orte: k.orte, erfassung: this.erfassungFuer(lg).erfassung, rueckmeldung: !!k.rueckmeldung, erstellt: jetzt(), beendet: null };
    f.loeschenAm = loeschtermin({ begonnen: f.erstellt });
    d.freigaben.unshift(f);
    await this.speichern();
    return { id: f.id, erfassung: this.erfassungFuer(lg) };
  }
  async quest(questId) {
    const d = await this.daten();
    const f = d.freigaben.find((x) => x.id === questId);
    if (!f) throw this.fehler(404, 'Quest nicht gefunden');
    const lg = d.lerngruppen.find((x) => x.id === f.lerngruppeId);
    const inhalte = await ladeInhalte();
    const orte = [];
    for (const { ort, aufgaben } of f.orte) {
      const o = inhalte.ortNach.get(ort);
      const liste = o ? await aufgabenVon(o, aufgaben).catch(() => []) : [];
      orte.push({ ort, name: o?.name ?? ort, region: o?.region ?? '', aufgaben: liste.map((a) => ({ nr: a.nr, titel: a.titel, format: a.format, dauerMinuten: a.dauerMinuten, stufe: a.stufe })) });
    }
    const gruppen = d.gruppen.filter((g) => g.freigabeId === f.id).map((g) => {
      const st = d.stationen.filter((x) => x.gruppeId === g.id);
      const l = d.laeufe.filter((x) => x.gruppeId === g.id).map((x) => x.aufgabe);
      return {
        id: g.id, bezeichnung: g.bezeichnung, code: g.code, erstellt: g.erstellt, letzteSync: g.letzteSync,
        aktuell: st.filter((x) => x.status === 'begonnen').sort((a, b) => (b.begonnen > a.begonnen ? 1 : -1))[0]?.ort ?? null,
        stationen: f.orte.map(({ ort, aufgaben }) => ({ ort, status: st.find((x) => x.ort === ort)?.status ?? 'offen', aufgabenFertig: l.filter((a) => a.startsWith(`${ort}/`) && aufgaben.includes(a.split('/')[1])).length, aufgaben: aufgaben.length })),
      };
    });
    return { id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, lerngruppe: { id: lg.id, bezeichnung: lg.bezeichnung, klassenstufe: lg.klassenstufe }, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschenAm, orte, gruppen, bildbeitraegeWartend: d.bildbeitraege.filter((b) => b.status === 'wartet' && gruppen.some((g) => g.id === b.gruppeId)).length };
  }
  async questBeenden(questId) {
    const d = await this.daten();
    const f = d.freigaben.find((x) => x.id === questId);
    f.beendet = jetzt();
    f.loeschenAm = loeschtermin({ abgeschlossen: f.beendet, begonnen: f.erstellt });
    await this.speichern();
    return { beendet: f.beendet };
  }
  async questLoeschen(questId, speichern = true) {
    const d = await this.daten();
    for (const g of d.gruppen.filter((x) => x.freigabeId === questId)) await this.gruppeLoeschen(g.id, false);
    d.freigaben = d.freigaben.filter((x) => x.id !== questId);
    if (speichern) await this.speichern();
    return { geloescht: true };
  }
  async gruppeAnlegen(questId, k) {
    const d = await this.daten();
    const p = pruefeBezeichnung(k.bezeichnung);
    if (!p.ok) throw this.fehler(400, p.fehler);
    if (p.hinweis && k.bestaetigt !== true) throw this.fehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
    if (d.gruppen.some((g) => g.freigabeId === questId && g.bezeichnung.toLowerCase() === p.name.toLowerCase())) throw this.fehler(409, 'Diese Bezeichnung gibt es in der Quest schon');
    const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const zufallsCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => zeichen[b % zeichen.length]).join('').replace(/^(.{4})/, '$1-');
    const g = { id: id(), freigabeId: questId, bezeichnung: p.name, code: zufallsCode(), einschaetzung: null, erstellt: jetzt(), letzteSync: null };
    d.gruppen.push(g);
    await this.speichern();
    return { id: g.id, bezeichnung: g.bezeichnung, code: g.code };
  }
  async gruppeAendern(gruppeId, k) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => x.id === gruppeId);
    if ('bezeichnung' in k) {
      const p = pruefeBezeichnung(k.bezeichnung);
      if (!p.ok) throw this.fehler(400, p.fehler);
      if (p.hinweis && k.bestaetigt !== true) throw this.fehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
      g.bezeichnung = p.name;
    }
    if ('einschaetzung' in k) g.einschaetzung = k.einschaetzung;
    await this.speichern();
    return { ok: true };
  }
  async gruppeLoeschen(gruppeId, speichern = true) {
    const d = await this.daten();
    d.gruppen = d.gruppen.filter((x) => x.id !== gruppeId);
    d.stationen = d.stationen.filter((x) => x.gruppeId !== gruppeId);
    d.laeufe = d.laeufe.filter((x) => x.gruppeId !== gruppeId);
    d.technik = d.technik.filter((x) => x.gruppeId !== gruppeId);
    d.bildbeitraege = d.bildbeitraege.filter((b) => b.gruppeId !== gruppeId || b.status === 'freigegeben').map((b) => (b.gruppeId === gruppeId ? { ...b, gruppeId: null } : b));
    if (speichern) await this.speichern();
    return { geloescht: true };
  }
  async auswertung(gruppeId) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => x.id === gruppeId);
    if (!g) throw this.fehler(404, 'Gruppe nicht gefunden');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    const inhalte = await ladeInhalte();
    const aufgabenInfo = new Map();
    for (const ort of inhalte.orte) for (const a of await aufgabenVon(ort).catch(() => [])) aufgabenInfo.set(a.kennung, a);
    const daten = {
      stationen: d.stationen.filter((x) => x.gruppeId === g.id).map((s) => ({ ...s, ortName: inhalte.ortNach.get(s.ort)?.name ?? s.ort })),
      laeufe: d.laeufe.filter((x) => x.gruppeId === g.id).sort((a, b) => (a.beendet < b.beendet ? -1 : 1)).map((l) => {
        const a = aufgabenInfo.get(l.aufgabe);
        return { ...l, ort: l.aufgabe.split('/')[0], titel: a?.titel ?? l.aufgabe, format: a?.format ?? null, stufe: a?.stufe ?? null, rollen: a?.rollen ?? null };
      }),
      technik: d.technik.filter((x) => x.gruppeId === g.id),
      bildbeitrag: d.bildbeitraege.find((b) => b.gruppeId === g.id) ?? null,
    };
    const einschaetzung = g.einschaetzung ?? {};
    const raster = kompetenzraster(daten, einschaetzung);
    return {
      gruppe: { id: g.id, bezeichnung: g.bezeichnung }, quest: f.titel, erfassung: f.erfassung, loeschenAm: f.loeschenAm,
      beobachtungen: beobachtungen(daten), raster, einschaetzung,
      entwurf: formulierungsentwurf(raster, { gruppe: g.bezeichnung, quest: f.titel, datum: datum(daten.laeufe.at(-1)?.beendet ?? g.erstellt) }),
      stand: daten.laeufe.at(-1)?.beendet ?? null,
    };
  }
  async bildbeitraege(questId) {
    const d = await this.daten();
    const gruppen = d.gruppen.filter((g) => g.freigabeId === questId);
    return d.bildbeitraege.filter((b) => gruppen.some((g) => g.id === b.gruppeId)).map((b) => ({ ...b, gruppe: gruppen.find((g) => g.id === b.gruppeId).bezeichnung }));
  }
  async bildbeitraegeEntscheiden(kennungen, freigeben) {
    const d = await this.daten();
    let n = 0;
    for (const b of d.bildbeitraege) if (kennungen.includes(b.kennung)) { b.status = freigeben ? 'freigegeben' : 'abgelehnt'; b.entschieden = jetzt(); n++; }
    await this.speichern();
    return { geaendert: n };
  }
  async vorschauUrl(eintrag) {
    const b = await ladeBild(eintrag.kennung).catch(() => null);
    return b ? URL.createObjectURL(b.vorschau) : 'app/bilder/symbol.svg';
  }
  async rueckmeldungenCsv(questId) {
    const d = await this.daten();
    const zeilen = d.rueckmeldungen.filter((r) => r.freigabeId === questId);
    return `aufgabe,verstaendlich,spass,schwierigkeit,zeit\n${zeilen.map((z) => [z.aufgabe, z.verstaendlich ?? '', z.spass ?? '', z.schwierigkeit ?? '', z.zeit].join(',')).join('\n')}\n`;
  }
  rueckmeldungenCsvUrl() { return '#'; }

  /** Setzt die Vorführung auf die Beispieldaten zurück. */
  async zuruecksetzen() { this.zustand = await beispieldaten(); await this.speichern(); }
}
