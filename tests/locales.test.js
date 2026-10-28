import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, STRINGS, buildMessages } from '../scripts/locales.mjs';

const root = path.resolve(import.meta.dirname, '..');

function filesIn(dir, exts) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return filesIn(full, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [full] : [];
  });
}

test('los _locales generados están al día con scripts/locales.mjs', () => {
  LOCALES.forEach((locale, i) => {
    const file = JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'));
    assert.deepEqual(file, buildMessages(i), `Ejecuta: node scripts/locales.mjs (${locale})`);
  });
});

test('cada idioma usa las mismas sustituciones $1, $2…', () => {
  for (const [key, values] of Object.entries(STRINGS)) {
    const subs = values.map((v) => (v.match(/\$\d/g) ?? []).sort().join(','));
    assert.ok(subs.every((x) => x === subs[0]), `${key}: ${subs.join(' | ')}`);
    assert.equal(values.length, LOCALES.length, key);
  }
});

test('toda clave usada en el código existe', () => {
  const used = new Set();
  for (const file of filesIn(path.join(root, 'src'), ['.js', '.html'])) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\('(\w+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/\btn\('(\w+)'/g)) used.add(`${m[1]}_one`).add(`${m[1]}_other`);
    for (const m of src.matchAll(/data-i18n(?:-\w+)?="(\w+)"/g)) used.add(m[1]);
    // t(cond ? 'a' : 'b')
    for (const m of src.matchAll(/\bt\([^()]*\?\s*'(\w+)'\s*:\s*'(\w+)'\)/g)) used.add(m[1]).add(m[2]);
  }
  const manifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');
  for (const m of manifest.matchAll(/__MSG_(\w+)__/g)) used.add(m[1]);

  const missing = [...used].filter((k) => !(k in STRINGS));
  assert.deepEqual(missing, []);
});
