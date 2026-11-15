// Die Schnittstellenbeschreibung stimmt mit der Umsetzung überein: jede Route steht in docs/openapi.json und umgekehrt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('docs/openapi.json beschreibt genau die Routen aus server/app.js', () => {
  const code = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
  const routen = new Set([...code.matchAll(/route\('(GET|POST|PATCH|DELETE)', '([^']+)'/g)].map(([, m, p]) => {
    const pfad = p.replace(/\(\[0-9a-fA-F-\]\{36\}\)/g, '{kennung}').replace(/\(\[A-Za-z0-9_-\]\+\)/g, '{id}').replace(/\(\\\\d\+\)/g, '{id}').replace(/\\\\\./g, '.');
    return `${m.toLowerCase()} ${pfad}`;
  }));
  const doku = JSON.parse(readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'));
  const beschrieben = new Set(Object.entries(doku.paths).flatMap(([p, ops]) => Object.keys(ops).filter((k) => ['get', 'post', 'patch', 'delete'].includes(k)).map((m) => `${m} ${p}`)));
  assert.deepEqual([...routen].filter((r) => !beschrieben.has(r)), [], 'Routen ohne Beschreibung');
  assert.deepEqual([...beschrieben].filter((r) => !routen.has(r)), [], 'Beschreibungen ohne Route');
  assert.equal(doku.openapi, '3.1.0');
});
