// Empaqueta la extensión para cada navegador en dist/:
//   tab-twins-<versión>-chromium.zip  (Chrome, Brave, Edge…)
//   tab-twins-<versión>-firefox.zip   (Firefox escritorio y Android; hay que firmarlo en AMO)
// Cada zip lleva un manifest con solo las claves de su navegador.
// Sin dependencias: el zip se escribe a mano con zlib (Node 22.2+ por zlib.crc32).
// Uso: node scripts/package.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const INCLUDE = ['_locales', 'icons', 'src', 'LICENSE'];

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

export function manifestFor(target, base = manifest) {
  const m = structuredClone(base);
  if (target === 'chromium') {
    delete m.browser_specific_settings;
    m.background = { service_worker: m.background.service_worker, type: m.background.type };
  } else {
    delete m.minimum_chrome_version;
    m.background = { scripts: m.background.scripts, type: m.background.type };
  }
  return m;
}

function listFiles(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [rel];
  return fs.readdirSync(full).sort().flatMap((name) => listFiles(path.join(rel, name)));
}

// Zip mínimo (deflate). Fecha fija para que el mismo código dé el mismo zip.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + deflated.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'scripts', 'package.mjs')) {
  const files = INCLUDE.flatMap(listFiles);
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  for (const target of ['chromium', 'firefox']) {
    const entries = [
      { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifestFor(target), null, 2) + '\n') },
      ...files.map((rel) => ({ name: rel, data: fs.readFileSync(path.join(root, rel)) })),
    ];
    const out = path.join(dist, `tab-twins-${manifest.version}-${target}.zip`);
    fs.writeFileSync(out, createZip(entries));
    console.log(`${path.relative(root, out)}  (${entries.length} archivos, ${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
  }
}
