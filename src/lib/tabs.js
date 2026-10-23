// Acceso a pestañas, ventanas y grupos de pestañas del navegador (popup y gestor).
// Firefox para Android no tiene las APIs windows ni tabGroups: todo lo que las
// usa debe funcionar sin ellas.

import { normalizeUrl } from './grouping.js';
import { t, uiLanguage } from './i18n.js';

export const MANAGER_PATH = 'src/manager/manager.html';

export const hasWindowsApi = () => Boolean(chrome.windows);
export const hasTabGroupsApi = () => Boolean(chrome.tabGroups);

/** true en móviles (Firefox para Android). */
export async function isMobile() {
  try {
    return (await chrome.runtime.getPlatformInfo()).os === 'android';
  } catch {
    return false;
  }
}

/** Pestañas http(s) abiertas, con su ventana y grupo de pestañas. */
export async function loadSnapshot() {
  const [allTabs, windows, tabGroups, current] = await Promise.all([
    chrome.tabs.query({}),
    hasWindowsApi() ? chrome.windows.getAll() : [],
    hasTabGroupsApi() ? chrome.tabGroups.query({}) : [],
    hasWindowsApi() ? chrome.windows.getCurrent() : null,
  ]);

  const windowLabels = new Map(windows.map((w, i) => [w.id, t('windowN', i + 1)]));
  const groupsById = new Map(tabGroups.map((g) => [g.id, g]));
  const tabs = allTabs.filter((t) => normalizeUrl(t.url));

  return {
    tabs,
    windows,
    windowLabels,
    // Con una sola ventana (o sin API de ventanas) no se muestra en qué ventana está cada pestaña.
    multiWindow: windows.length > 1,
    tabGroups,
    groupsById,
    currentWindowId: current?.id ?? allTabs[0]?.windowId ?? null,
  };
}

export async function focusWindow(windowId) {
  if (hasWindowsApi()) await chrome.windows.update(windowId, { focused: true });
}

export async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await focusWindow(tab.windowId);
}

/** Cierra pestañas y devuelve lo necesario para reabrirlas (deshacer). */
export async function closeTabs(tabs) {
  const restore = tabs.map((t) => ({
    url: t.url,
    windowId: t.windowId,
    index: t.index,
    pinned: t.pinned,
    groupId: t.groupId,
  }));
  await chrome.tabs.remove(tabs.map((t) => t.id));
  return restore;
}

/** Reabre pestañas cerradas en su ventana y grupo originales si siguen existiendo. */
export async function reopenTabs(restore) {
  const windowIds = new Set(hasWindowsApi() ? (await chrome.windows.getAll()).map((w) => w.id) : []);
  for (const t of [...restore].sort((a, b) => a.index - b.index)) {
    const sameWindow = windowIds.has(t.windowId);
    const created = await chrome.tabs.create({
      url: t.url,
      windowId: sameWindow ? t.windowId : undefined,
      index: sameWindow ? t.index : undefined,
      pinned: t.pinned,
      active: false,
    });
    if (sameWindow && t.groupId > -1 && chrome.tabs.group) {
      await chrome.tabs.group({ tabIds: created.id, groupId: t.groupId }).catch(() => {});
    }
  }
}

// Acceso a las webs: sin él no hay capturas ni scroll. En Firefox el usuario
// puede no concederlo al instalar, y en ambos navegadores puede retirarlo.
const ALL_SITES = { origins: ['<all_urls>'] };
export const hasSiteAccess = () => chrome.permissions.contains(ALL_SITES);
/** Debe llamarse desde un clic del usuario. */
export const requestSiteAccess = () => chrome.permissions.request(ALL_SITES);

/** Abre el gestor o reutiliza su pestaña si ya está abierto. */
export async function openManager(search = '') {
  const base = chrome.runtime.getURL(MANAGER_PATH);
  const url = base + search;
  const [existing] = (await chrome.tabs.query({})).filter((t) => t.url?.startsWith(base));
  if (existing) {
    await chrome.tabs.update(existing.id, { url, active: true });
    await focusWindow(existing.windowId);
  } else {
    await chrome.tabs.create({ url });
  }
}

/** Scroll actual leído de la página; `null` si la pestaña está dormida o no se puede leer. */
export async function readLiveScroll(tab) {
  if (tab.discarded || tab.status === 'unloaded') return null;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.scrollingElement || document.documentElement;
        const max = el.scrollHeight - window.innerHeight;
        return { pct: max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0, y: Math.round(window.scrollY) };
      },
    });
    return res?.result ? { ...res.result, t: Date.now(), live: true } : null;
  } catch {
    return null;
  }
}

const rtf = new Intl.RelativeTimeFormat(uiLanguage(), { numeric: 'auto' });

export function timeAgo(ms) {
  if (!ms) return t('timeUnknown');
  const sec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return t('timeJustNow');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
  return rtf.format(Math.round(sec / (86400 * 30)), 'month');
}

/** Búsqueda sin tildes ni mayúsculas: todas las palabras deben aparecer en título o URL. */
export function matchesQuery(tab, query) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const haystack = fold(`${tab.title} ${tab.url}`);
  return fold(query).split(/\s+/).filter(Boolean).every((w) => haystack.includes(w));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const GROUP_COLORS = {
  grey: '#80868b',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};
