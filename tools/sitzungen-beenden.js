#!/usr/bin/env node
// Beendet alle Sitzungen (Lehrkräfte, Lernende, Verwaltung) und optional alle Gerätezugänge der Gruppen.
// Für den Verdacht auf einen Sicherheitsvorfall. Aufruf: node tools/sitzungen-beenden.js [--geraete]
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(join(resolve(process.env.SPUR_DATEN ?? 'daten'), 'spurensuche.db'));
db.exec('PRAGMA busy_timeout = 10000');
const s = db.prepare('DELETE FROM sitzung').run().changes;
const g = process.argv.includes('--geraete') ? db.prepare('DELETE FROM geraet').run().changes : 0;
db.prepare("INSERT INTO protokoll (zeit, rolle, aktion, ziel) VALUES (?, 'verwaltung', 'sitzungen-beendet', ?)").run(new Date().toISOString(), `${s}/${g}`);
db.close();
console.log(`${s} Sitzungen beendet${g ? `, ${g} Gerätezugänge entzogen (Gruppen treten mit ihrem Code neu bei)` : ''}.`);
