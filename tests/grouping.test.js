import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  extractChapter,
  urlWorkKey,
  titleKey,
  workLabel,
  groupDuplicates,
  pickKeeper,
  duplicatesToClose,
} from '../src/lib/grouping.js';

let nextId = 1;
const tab = (url, title, extra = {}) => ({ id: nextId++, url, title, lastAccessed: 0, pinned: false, ...extra });

test('normalizeUrl ignora protocolo, www, fragmento, barra final y rastreo', () => {
  assert.equal(
    normalizeUrl('https://www.site.com/novel/x/?utm_source=a&b=2&a=1#top'),
    normalizeUrl('http://site.com/novel/x?a=1&b=2'),
  );
  assert.equal(normalizeUrl('chrome://newtab/'), null);
  assert.equal(normalizeUrl('no es una url'), null);
});

test('extractChapter reconoce formatos habituales', () => {
  assert.equal(extractChapter('Solo Leveling Chapter 123 - NovelSite'), 123);
  assert.equal(extractChapter('Novela X - Capítulo 7'), 7);
  assert.equal(extractChapter('Novela X Cap. 45'), 45);
  assert.equal(extractChapter('Ch.12: El inicio'), 12);
  assert.equal(extractChapter('某小说 第88章'), 88);
  assert.equal(extractChapter('', 'https://site.com/novel/x/chapter-9'), 9);
  assert.equal(extractChapter('', 'https://site.com/novel/x-chapter-10-titulo'), 10);
  assert.equal(extractChapter('Capture the flag 2'), null);
  assert.equal(extractChapter('Hilo', 'https://foro.com/hilo/123'), null);
});

test('urlWorkKey quita el capítulo de la URL', () => {
  const a = urlWorkKey('https://site.com/novel/solo-leveling/chapter-5');
  const b = urlWorkKey('https://site.com/novel/solo-leveling/chapter-12');
  assert.equal(a.key, b.key);
  assert.ok(a.strong);

  const slugA = urlWorkKey('https://site.com/solo-leveling-chapter-5');
  const slugB = urlWorkKey('https://site.com/solo-leveling-chapter-6-the-end');
  assert.equal(slugA.key, slugB.key);

  const q = urlWorkKey('https://site.com/read?id=7&chapter=3');
  assert.equal(q.key, 'site.com/read?id=7');
  assert.ok(q.strong);

  assert.equal(urlWorkKey('https://site.com/novel/solo-leveling/123').weak, true);
  assert.equal(urlWorkKey('https://foro.com/foro/hilo/123').weak, false);
});

test('titleKey y workLabel quitan el capítulo', () => {
  assert.equal(titleKey('Solo Leveling Chapter 5 - NovelSite').key, titleKey('Solo Leveling Chapter 12 - NovelSite').key);
  assert.equal(titleKey('Capítulo 3 · Mi Novela').key, 'mi novela');
  assert.equal(workLabel('Solo Leveling Chapter 5 - NovelSite'), 'Solo Leveling - NovelSite');
});

test('agrupa la misma URL como idénticas', () => {
  const groups = groupDuplicates([
    tab('https://site.com/a', 'A'),
    tab('https://site.com/a#x', 'A'),
    tab('https://site.com/b', 'B'),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, 'exact');
  assert.equal(groups[0].tabs.length, 2);
});

test('agrupa capítulos distintos de la misma novela', () => {
  const groups = groupDuplicates([
    tab('https://novels.com/novel/solo-leveling/chapter-5', 'Solo Leveling Chapter 5 - Novels'),
    tab('https://novels.com/novel/solo-leveling/chapter-12', 'Solo Leveling Chapter 12 - Novels'),
    tab('https://novels.com/novel/otra/chapter-12', 'Otra Chapter 12 - Novels'),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, 'similar');
  assert.deepEqual(groups[0].tabs.map((t) => t.chapter), [5, 12]);
});

test('agrupa por título aunque la URL no tenga capítulo reconocible', () => {
  const groups = groupDuplicates([
    tab('https://lector.com/r/abc', 'Mi Novela - Capítulo 1'),
    tab('https://lector.com/r/xyz', 'Mi Novela - Capítulo 30'),
  ]);
  assert.equal(groups.length, 1);
});

test('no agrupa páginas distintas con números sueltos', () => {
  const groups = groupDuplicates([
    tab('https://github.com/user/my-repo/issues/1', 'Bug en el login · Issue #1'),
    tab('https://github.com/user/my-repo/issues/2', 'Añadir modo oscuro · Issue #2'),
    tab('https://foro.com/foro/hilo/10', 'Hilo uno'),
    tab('https://foro.com/foro/hilo/11', 'Hilo dos'),
  ]);
  assert.equal(groups.length, 0);
});

test('número suelto agrupa si los títulos se parecen', () => {
  const groups = groupDuplicates([
    tab('https://site.com/book/4512/101.html', 'Gran Novela 101 Lectura online'),
    tab('https://site.com/book/4512/250.html', 'Gran Novela 250 Lectura online'),
  ]);
  assert.equal(groups.length, 1);
});

test('no mezcla webs distintas por título', () => {
  const groups = groupDuplicates([
    tab('https://a.com/x', 'Mi Novela Capítulo 1'),
    tab('https://b.com/y', 'Mi Novela Capítulo 2'),
  ]);
  assert.equal(groups.length, 0);
});

test('pickKeeper según la regla', () => {
  const tabs = [
    { id: 1, chapter: 5, lastAccessed: 300 },
    { id: 2, chapter: 12, lastAccessed: 100 },
    { id: 3, chapter: 8, lastAccessed: 200 },
  ];
  assert.equal(pickKeeper(tabs, 'chapter').id, 2);
  assert.equal(pickKeeper(tabs, 'recent').id, 1);
  assert.equal(pickKeeper(tabs, 'oldest').id, 1);
});

test('duplicatesToClose nunca cierra la conservada ni las fijadas', () => {
  const group = {
    tabs: [
      { id: 1, chapter: 5, pinned: true },
      { id: 2, chapter: 12 },
      { id: 3, chapter: 8 },
    ],
  };
  assert.deepEqual(duplicatesToClose(group, 'chapter'), [3]);
});
