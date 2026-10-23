// Detección de pestañas duplicadas. Funciones puras: no usan APIs de chrome.*
// para poder probarlas con `node --test`.

const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|dclid|msclkid|igshid|mc_cid|mc_eid|_ga|ref|ref_src|source|si)$/i;

// Palabras que preceden a un número de capítulo.
const CHAPTER_WORD = String.raw`(?:chapter|chap|ch|cap[ií]tulo|capitulo|cap|episode|episodio|ep)`;
const TITLE_CHAPTER_RE = new RegExp(String.raw`(?:^|[^\p{L}])${CHAPTER_WORD}\.?\s*[-:#nº°]*\s*(\d+(?:\.\d+)?)`, 'iu');
const CJK_CHAPTER_RE = /第\s*(\d+)\s*[章话話回]/;
// Segmento de URL que es solo un capítulo: "chapter-12", "c12", "cap_3.html".
const SEGMENT_CHAPTER_RE = new RegExp(String.raw`^(?:${CHAPTER_WORD}|c)[-_.]?(\d+(?:[.-]\d+)?)(?:\.html?)?$`, 'i');
// Sufijo de capítulo dentro de un slug: "solo-leveling-chapter-12".
const SLUG_CHAPTER_RE = new RegExp(String.raw`[-_]${CHAPTER_WORD}[-_]?(\d+(?:[.-]\d+)?)(?:[-_].*)?(?:\.html?)?$`, 'i');
const NUMERIC_SEGMENT_RE = /^(\d+)(?:\.html?)?$/i;
const CHAPTER_QUERY_RE = /^(chapter|chap|ch|cap|capitulo|episode|ep)$/i;

const MIN_TITLE_SIMILARITY = 0.5;

/** URL comparable: sin protocolo, sin `www.`, sin #fragmento ni parámetros de rastreo. `null` si no es http(s). */
export function normalizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let path = url.pathname.replace(/\/+$/, '') || '/';
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return host + path + (query ? `?${query}` : '');
}

function titleChapter(title = '') {
  const match = title.match(TITLE_CHAPTER_RE) || title.match(CJK_CHAPTER_RE);
  return match ? Number(match[1]) : null;
}

/** Número de capítulo a partir del título o la URL; `null` si no se reconoce. */
export function extractChapter(title = '', rawUrl = '') {
  const fromTitle = titleChapter(title);
  if (fromTitle != null) return fromTitle;

  const work = urlWorkKey(rawUrl);
  return work ? work.chapter : null;
}

/**
 * Clave de "la obra" a partir de la URL, quitando el capítulo.
 * - `strong`: se quitó un capítulo explícito (chapter-12, ?ch=3…): basta para agrupar.
 * - `weak`: solo se quitó un número suelto (/novela/123): hay que confirmarlo con el título.
 */
export function urlWorkKey(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  let strong = false;
  let weak = false;
  let chapter = null;

  // Como mucho dos segmentos finales: /novela/x/volumen-1/capitulo-3
  for (let i = 0; i < 2 && segments.length > 0; i++) {
    const last = segments[segments.length - 1];
    const segMatch = last.match(SEGMENT_CHAPTER_RE);
    if (segMatch) {
      chapter ??= Number(segMatch[1].replace('-', '.'));
      segments.pop();
      strong = true;
      continue;
    }
    const slugMatch = last.match(SLUG_CHAPTER_RE);
    if (slugMatch) {
      chapter ??= Number(slugMatch[1].replace('-', '.'));
      segments[segments.length - 1] = last.slice(0, slugMatch.index);
      strong = true;
      break;
    }
    const numMatch = !strong && i === 0 && last.match(NUMERIC_SEGMENT_RE);
    if (numMatch) {
      chapter ??= Number(numMatch[1]);
      segments.pop();
      weak = true;
    }
    break;
  }

  const params = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (TRACKING_PARAMS.test(key)) continue;
    if (CHAPTER_QUERY_RE.test(key) && /^\d+(\.\d+)?$/.test(value)) {
      chapter ??= Number(value);
      strong = true;
      continue;
    }
    params.push([key, value]);
  }
  params.sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();

  // Un número suelto solo cuenta si queda algo que identifique la obra
  // (/novela/solo-leveling/123 sí, /foro/hilo/123 no).
  if (weak && !strong) {
    const identifies = segments.some((s) => /[-_]/.test(s) && s.length >= 6) || segments.slice(1).some((s) => /^\d+$/.test(s));
    if (!identifies) weak = false;
  }

  return {
    key: host + '/' + segments.join('/') + (query ? `?${query}` : ''),
    strong,
    weak: weak && !strong,
    chapter: strong || weak ? chapter : null,
  };
}

const PAGE_EXT_RE = /\.(html?|php|aspx?)$/i;

function pathSegments(url) {
  const segments = url.pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
  if (segments.length) segments[segments.length - 1] = segments[segments.length - 1].replace(PAGE_EXT_RE, '');
  return segments;
}

function parseHttp(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const hostKey = (url) => url.hostname.toLowerCase().replace(/^www\./, '');

/**
 * Clave de una posible ficha de obra (sinopsis, índice): la ruta sin extensión.
 * `null` si es demasiado genérica (/, /novel) o tiene parámetros (búsquedas, listados).
 */
export function workPageKey(rawUrl) {
  const url = parseHttp(rawUrl);
  if (!url) return null;
  if ([...url.searchParams.keys()].some((k) => !TRACKING_PARAMS.test(k))) return null;
  const segments = pathSegments(url);
  const specific = segments.length >= 2 || (segments.length === 1 && /[-_]/.test(segments[0]) && segments[0].length >= 6);
  return specific ? `${hostKey(url)}/${segments.join('/')}` : null;
}

/** Rutas "padre" de un capítulo donde podría estar la ficha de su obra. */
function parentPageKeys(rawUrl, work) {
  const url = parseHttp(rawUrl);
  if (!url) return [];
  const segments = pathSegments(url);
  const keys = [];
  for (let n = 1; n < segments.length; n++) keys.push(`${hostKey(url)}/${segments.slice(0, n).join('/')}`);
  // /novela/obra-chapter-7 -> /novela/obra
  if (work?.strong && !work.key.includes('?')) keys.push(work.key.toLowerCase().replace(PAGE_EXT_RE, ''));
  return keys;
}

/** Título sin capítulo, sin números ni signos y sin tildes; sirve de clave. */
export function titleKey(title = '') {
  const hadChapter = TITLE_CHAPTER_RE.test(title) || CJK_CHAPTER_RE.test(title);
  const key = title
    .replace(new RegExp(TITLE_CHAPTER_RE.source, 'giu'), ' ')
    .replace(new RegExp(CJK_CHAPTER_RE.source, 'g'), ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^\p{L}]+/gu, ' ')
    .trim();
  return { key, hadChapter };
}

/** Título legible de la obra: el título original sin la parte del capítulo. */
export function workLabel(title = '') {
  const cleaned = title
    .replace(new RegExp(TITLE_CHAPTER_RE.source, 'giu'), ' ')
    .replace(new RegExp(CJK_CHAPTER_RE.source, 'g'), ' ')
    .replace(/\s*[-–—|:·]\s*(?=[-–—|:·]|$)/g, '')
    .replace(/^\s*[-–—|:·]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || title;
}

function words(key) {
  return new Set(key.split(' ').filter((w) => w.length > 1));
}

function similarity(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

function hostOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Agrupa pestañas duplicadas.
 * @param {Array<{id:number,url:string,title:string}>} tabs
 * @returns {Array<{id:string, kind:'exact'|'similar', label:string, host:string, tabs:Array}>}
 *   Solo grupos de 2 o más pestañas, de mayor a menor.
 */
export function groupDuplicates(tabs) {
  const items = [];
  for (const tab of tabs) {
    const norm = normalizeUrl(tab.url);
    if (!norm) continue;
    items.push({
      tab,
      norm,
      host: hostOf(tab.url),
      work: urlWorkKey(tab.url),
      title: titleKey(tab.title),
      chapter: extractChapter(tab.title, tab.url),
      // Capítulo detectado con seguridad: en el título o con "chapter"/"cap" en la URL.
      // Un número suelto (/issues/4) no basta para enlazar con la ficha.
      sureChapter: titleChapter(tab.title) != null || Boolean(urlWorkKey(tab.url)?.strong),
      workPage: false,
    });
  }

  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const unionByKey = (keyOf) => {
    const firstByKey = new Map();
    items.forEach((item, i) => {
      const key = keyOf(item);
      if (!key) return;
      if (firstByKey.has(key)) union(firstByKey.get(key), i);
      else firstByKey.set(key, i);
    });
  };

  unionByKey((it) => `exact:${it.norm}`);
  unionByKey((it) => (it.work?.strong ? `url:${it.work.key}` : null));
  unionByKey((it) => (it.title.hadChapter && it.title.key.length >= 3 ? `title:${it.host}|${it.title.key}` : null));

  // Número suelto en la URL: solo si además los títulos se parecen.
  const weakBuckets = new Map();
  items.forEach((it, i) => {
    if (!it.work?.weak) return;
    const list = weakBuckets.get(it.work.key) ?? [];
    list.push(i);
    weakBuckets.set(it.work.key, list);
  });
  for (const list of weakBuckets.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        if (similarity(items[list[a]].title.key, items[list[b]].title.key) >= MIN_TITLE_SIMILARITY) {
          union(list[a], list[b]);
        }
      }
    }
  }

  // Ficha de la obra: página sin capítulo de cuya ruta cuelgan capítulos abiertos.
  const pagesByKey = new Map();
  items.forEach((it, i) => {
    if (it.chapter != null) return;
    const key = workPageKey(it.tab.url);
    if (key) pagesByKey.set(key, [...(pagesByKey.get(key) ?? []), i]);
  });
  items.forEach((it, i) => {
    if (!it.sureChapter) return;
    for (const key of parentPageKeys(it.tab.url, it.work)) {
      for (const j of pagesByKey.get(key) ?? []) {
        union(i, j);
        items[j].workPage = true;
      }
    }
  });

  const clusters = new Map();
  items.forEach((it, i) => {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(it);
    clusters.set(root, list);
  });

  const groups = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const exact = members.every((m) => m.norm === members[0].norm);
    const sorted = [...members].sort((a, b) => (a.chapter ?? -1) - (b.chapter ?? -1) || a.tab.id - b.tab.id);
    groups.push({
      // Estable mientras siga abierta la pestaña con id más bajo.
      id: String(Math.min(...members.map((m) => m.tab.id))),
      kind: exact ? 'exact' : 'similar',
      label: workLabel(sorted[0].tab.title || sorted[0].norm),
      host: sorted[0].host,
      tabs: sorted.map((m) => ({ ...m.tab, chapter: m.chapter, norm: m.norm, workPage: m.workPage })),
    });
  }
  return groups.sort((a, b) => b.tabs.length - a.tabs.length || a.label.localeCompare(b.label));
}

export const KEEP_RULES = {
  chapter: 'Capítulo más avanzado',
  recent: 'Visitada más recientemente',
  oldest: 'Abierta primero',
};

/**
 * Pestaña que se conserva al cerrar las duplicadas de un grupo.
 * Las fijadas siempre se conservan; esta función elige una más entre el resto.
 */
export function pickKeeper(tabs, rule = 'chapter') {
  const byRecent = (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0);
  const sorted = [...tabs];
  if (rule === 'oldest') sorted.sort((a, b) => a.id - b.id);
  else if (rule === 'recent') sorted.sort(byRecent);
  else sorted.sort((a, b) => (b.chapter ?? -1) - (a.chapter ?? -1) || byRecent(a, b));
  return sorted[0];
}

/** Ids de las pestañas a cerrar en un grupo según la regla (nunca fijadas ni la conservada). */
export function duplicatesToClose(group, rule = 'chapter') {
  const keeper = pickKeeper(group.tabs, rule);
  return group.tabs.filter((t) => t.id !== keeper.id && !t.pinned).map((t) => t.id);
}
