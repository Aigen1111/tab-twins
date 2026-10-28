// Fuente única de los textos de la interfaz. Genera _locales/<idioma>/messages.json.
// Uso: node scripts/locales.mjs
// Claves con _one / _other: plural (ver tn() en src/lib/i18n.js).
// $1, $2…: sustituciones de chrome.i18n.getMessage.

import fs from 'node:fs';
import path from 'node:path';

export const LOCALES = ['en', 'es'];

// clave: [inglés, español]
export const STRINGS = {
  extName: ['Tab Twins', 'Tab Twins'],
  extDescription: [
    'Find duplicate tabs (like the same web novel open at different chapters), compare them and decide which to close.',
    'Encuentra pestañas duplicadas (por ejemplo, la misma novela en capítulos distintos), compáralas y decide cuáles cerrar.',
  ],

  // Comunes
  windowN: ['Window $1', 'Ventana $1'],
  windowThis: ['$1 (this one)', '$1 (esta)'],
  unnamedGroup: ['Unnamed group', 'Grupo sin nombre'],
  timeUnknown: ['unknown', 'desconocida'],
  timeJustNow: ['just now', 'ahora mismo'],
  compare: ['Compare', 'Comparar'],
  tabsCount_one: ['1 tab', '1 pestaña'],
  tabsCount_other: ['$1 tabs', '$1 pestañas'],
  groupsOfDupes_one: ['1 duplicate group', '1 grupo de duplicadas'],
  groupsOfDupes_other: ['$1 duplicate groups', '$1 grupos de duplicadas'],
  kindExact: ['Identical', 'Idénticas'],
  kindSimilar: ['Same work', 'Misma obra'],
  kindExactLower: ['identical', 'idénticas'],
  kindSimilarLower: ['same work', 'misma obra'],
  chapterShort: ['Ch. $1', 'Cap. $1'],
  workPage: ['Series page', 'Ficha de la obra'],

  // Popup
  searchPlaceholder: ['Search your open tabs…', 'Buscar en tus pestañas abiertas…'],
  reviewDuplicates: ['Review duplicates', 'Revisar duplicados'],
  currentTwins_one: ['This tab has <strong>1 twin</strong> open.', 'Esta pestaña tiene <strong>1 gemela</strong> abierta.'],
  currentTwins_other: ['This tab has <strong>$1 twins</strong> open.', 'Esta pestaña tiene <strong>$1 gemelas</strong> abiertas.'],
  extraTabs_one: ['1 tab too many', '1 pestaña sobra'],
  extraTabs_other: ['$1 tabs too many', '$1 pestañas sobran'],
  noDuplicatesAmong: ['No duplicate tabs among $1 open.', 'No hay pestañas duplicadas entre $1 abiertas.'],
  results_one: ['1 result', '1 resultado'],
  results_other: ['$1 results', '$1 resultados'],
  resultsMore: ['More than $1 results', 'Más de $1 resultados'],
  duplicateChip: ['Duplicate', 'Duplicada'],

  // Gestor: cabecera y filtros
  managerTitle: ['Tab Twins · Duplicates', 'Tab Twins · Duplicadas'],
  closeSelected: ['Close selected ($1)', 'Cerrar seleccionadas ($1)'],
  closeAllDupes: ['Close all duplicates ($1)', 'Cerrar todas las duplicadas ($1)'],
  filterPlaceholder: ['Filter by title or site…', 'Filtrar por título o web…'],
  ariaWindow: ['Window', 'Ventana'],
  ariaTabGroup: ['Tab group', 'Grupo de pestañas'],
  ariaKind: ['Type', 'Tipo'],
  kindAll: ['Identical and same work', 'Idénticas y misma obra'],
  kindExactOnly: ['Identical only', 'Solo idénticas'],
  kindSimilarOnly: ['Same work only', 'Solo misma obra'],
  keepRuleLabel: ['When closing duplicates, keep', 'Al cerrar duplicadas, conservar'],
  ruleChapter: ['furthest chapter', 'capítulo más avanzado'],
  ruleRecent: ['most recently visited', 'visitada más recientemente'],
  ruleOldest: ['opened first', 'abierta primero'],
  autoCapture: ['Automatic screenshots', 'Capturas automáticas'],
  allWindows: ['All windows', 'Todas las ventanas'],
  allTabGroups: ['All tab groups', 'Todos los grupos de pestañas'],
  noTabGroup: ['No tab group', 'Sin grupo de pestañas'],
  statsExtra: ['$1 extra', '$1 de sobra'],
  openTabs_one: ['1 open tab', '1 pestaña abierta'],
  openTabs_other: ['$1 open tabs', '$1 pestañas abiertas'],
  statsNone: ['No duplicates', 'Sin duplicadas'],
  accessText: [
    'Without access to websites, screenshots and reading progress can’t be saved.',
    'Sin acceso a las webs no se pueden hacer capturas ni saber cuánto llevas leído.',
  ],
  grantAccess: ['Grant access', 'Dar acceso'],
  accessGranted: [
    'Access granted. Screenshots and reading progress will now be saved.',
    'Acceso concedido. Las capturas y el scroll empezarán a guardarse.',
  ],

  // Gestor: lista
  repeated: ['Repeated', 'Repetida'],
  repeatedTitle: ['Another tab has exactly the same URL', 'Hay otra pestaña con exactamente la misma URL'],
  visited: ['visited $1', 'visitada $1'],
  readPct: ['$1% read', '$1 % leído'],
  pct: ['$1%', '$1 %'],
  pinned: ['pinned', 'fijada'],
  discarded: ['sleeping', 'dormida'],
  select: ['Select', 'Seleccionar'],
  selectGroup: ['Select whole group', 'Seleccionar todo el grupo'],
  kept: ['Kept', 'Se conserva'],
  keptTitle: ['The one kept by “Close duplicates”', 'La que se queda al usar «Cerrar duplicadas»'],
  go: ['Go', 'Ir'],
  close: ['Close', 'Cerrar'],
  closeGroupDupes: ['Close duplicates ($1)', 'Cerrar duplicadas ($1)'],
  emptyFilteredTitle: ['Nothing matches these filters.', 'Nada con estos filtros.'],
  emptyFilteredHint: ['Try removing a filter.', 'Prueba a quitar algún filtro.'],
  emptyTitle: ['No duplicate tabs.', 'No hay pestañas duplicadas.'],
  emptyHint: [
    'When you open the same page twice, or chapters of the same work, they’ll show up here.',
    'Cuando abras dos veces la misma página o capítulos de la misma obra, aparecerán aquí.',
  ],

  // Gestor: comparar
  noDupesLeft: ['No duplicates left in that group.', 'Ya no quedan duplicadas en ese grupo.'],
  shotAlt: ['Page screenshot', 'Captura de la página'],
  shotAge: ['captured $1', 'captura $1'],
  noShot: ['No screenshot', 'Sin captura'],
  capture: ['Capture', 'Capturar'],
  factChapter: ['Chapter', 'Capítulo'],
  mostAdvanced: ['Furthest', 'Más avanzado'],
  factLastVisit: ['Last visit', 'Última visita'],
  mostRecent: ['Most recent', 'Más reciente'],
  factRead: ['Read', 'Leído'],
  mostRead: ['Most read', 'Más leído'],
  readNow: ['now', 'ahora'],
  readSaved: ['saved $1', 'guardado $1'],
  noScrollData: ['No data (reload the tab or scroll in it)', 'Sin datos (recarga la pestaña o desplázate en ella)'],
  factLocation: ['Location', 'Ubicación'],
  closeThis: ['Close this one', 'Cerrar esta'],
  keepOnly: ['Keep only this one', 'Quedarme solo con esta'],
  compareAria: ['Compare tabs', 'Comparar pestañas'],
  refreshShots: ['Refresh screenshots', 'Actualizar capturas'],
  refreshShotsTitle: ['Briefly switches to each tab to capture it', 'Activa cada pestaña un momento para hacerle una captura'],
  closeCompareAria: ['Close comparison', 'Cerrar comparación'],
  capturing: ['Capturing… each tab will be shown for a moment.', 'Capturando… las pestañas se activarán un momento.'],
  capturesUpdated: ['Screenshots updated.', 'Capturas actualizadas.'],

  // Gestor: cerrar
  confirmClose_one: ['Close 1 tab?', '¿Cerrar 1 pestaña?'],
  confirmClose_other: ['Close $1 tabs?', '¿Cerrar $1 pestañas?'],
  confirmCloseAll: ['Close $1 from $2?', '¿Cerrar $1 de $2?'],
  dupes_one: ['1 duplicate', '1 duplicada'],
  dupes_other: ['$1 duplicates', '$1 duplicadas'],
  groups_one: ['1 group', '1 grupo'],
  groups_other: ['$1 groups', '$1 grupos'],
  andMore: ['and $1 more…', 'y $1 más…'],
  undoHint: ['You can undo this right after.', 'Podrás deshacerlo justo después.'],
  cancel: ['Cancel', 'Cancelar'],
  confirmCloseN: ['Close $1', 'Cerrar $1'],
  closedTabs_one: ['Closed 1 tab.', 'Cerrada 1 pestaña.'],
  closedTabs_other: ['Closed $1 tabs.', 'Cerradas $1 pestañas.'],
  undo: ['Undo', 'Deshacer'],
  keepNoteOne: ['Keeping: <strong>$1</strong>. Pinned tabs are never closed.', 'Se conserva: <strong>$1</strong>. Las fijadas nunca se cierran.'],
  keepNoteMany: ['One tab is kept per group ($1). Pinned tabs are never closed.', 'Se conserva una pestaña por grupo ($1). Las fijadas nunca se cierran.'],
  manualNote: ['You picked these tabs yourself.', 'Has elegido estas pestañas a mano.'],
};

export function buildMessages(localeIndex) {
  return Object.fromEntries(Object.entries(STRINGS).map(([key, values]) => [key, { message: values[localeIndex] }]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
  LOCALES.forEach((locale, i) => {
    const dir = path.join(root, '_locales', locale);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'messages.json'), JSON.stringify(buildMessages(i), null, 2) + '\n');
  });
  console.log(`${Object.keys(STRINGS).length} textos → ${LOCALES.join(', ')}`);
}
