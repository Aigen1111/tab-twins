import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createZip, manifestFor } from '../scripts/package.mjs';

const base = {
  minimum_chrome_version: '121',
  browser_specific_settings: { gecko: { id: 'x@y' } },
  background: { service_worker: 'bg.js', scripts: ['bg.js'], type: 'module' },
};

test('el manifest de Chromium no lleva claves de Firefox', () => {
  const m = manifestFor('chromium', base);
  assert.equal(m.browser_specific_settings, undefined);
  assert.deepEqual(m.background, { service_worker: 'bg.js', type: 'module' });
  assert.equal(m.minimum_chrome_version, '121');
});

test('el manifest de Firefox no lleva claves de Chrome', () => {
  const m = manifestFor('firefox', base);
  assert.equal(m.minimum_chrome_version, undefined);
  assert.deepEqual(m.background, { scripts: ['bg.js'], type: 'module' });
  assert.deepEqual(m.browser_specific_settings, base.browser_specific_settings);
});

test('createZip escribe entradas que se pueden leer', () => {
  const data = Buffer.from('hola, pestañas'.repeat(20));
  const zip = createZip([{ name: 'a/b.txt', data }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const nameLen = zip.readUInt16LE(26);
  const compressedSize = zip.readUInt32LE(18);
  assert.equal(zip.subarray(30, 30 + nameLen).toString(), 'a/b.txt');
  const body = zip.subarray(30 + nameLen, 30 + nameLen + compressedSize);
  assert.deepEqual(zlib.inflateRawSync(body), data);
  assert.equal(zip.readUInt32LE(14), zlib.crc32(data));
  // Fin del directorio central
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
});
