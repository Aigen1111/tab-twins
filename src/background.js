import { groupDuplicates, normalizeUrl } from './lib/grouping.js';
import { getSettings, scrollKey, shotKey } from './lib/store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Contador en el icono ----------

let badgeTimer;
function scheduleBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 400);
}

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  const extra = groupDuplicates(tabs).reduce((n, g) => n + g.tabs.length - 1, 0);
  await chrome.action.setBadgeBackgroundColor({ color: '#c2410c' });
  await chrome.action.setBadgeText({ text: extra ? String(extra) : '' });
}

// ---------- Capturas ----------
// captureVisibleTab solo captura la pestaña visible de una ventana y Chrome
// limita a 2 llamadas por segundo, así que se encolan.

const CAPTURE_GAP_MS = 600;
const SHOT_WIDTH = 480;
let lastCapture = 0;
let captureChain = Promise.resolve();

function enqueueCapture(task) {
  const run = captureChain.then(async () => {
    const wait = lastCapture + CAPTURE_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastCapture = Date.now();
    }
  });
  captureChain = run.catch(() => {});
  return run;
}

async function toSmallDataUrl(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, SHOT_WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function captureTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.active || tab.status !== 'complete') return false;
  const norm = normalizeUrl(tab.url);
  if (!norm) return false;
  const win = await chrome.windows.get(tab.windowId);
  if (win.state === 'minimized') return false;

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
  // Si mientras tanto cambió la pestaña visible, la captura sería de otra página.
  const [stillActive] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (stillActive?.id !== tabId || stillActive.url !== tab.url) return false;

  await chrome.storage.local.set({ [shotKey(norm)]: { data: await toSmallDataUrl(dataUrl), t: Date.now() } });
  return true;
}

const autoTimers = new Map();
async function scheduleAutoCapture(tabId) {
  if (!(await getSettings()).autoCapture) return;
  clearTimeout(autoTimers.get(tabId));
  autoTimers.set(tabId, setTimeout(() => {
    autoTimers.delete(tabId);
    enqueueCapture(() => captureTab(tabId)).catch(() => {});
  }, 800));
}

function waitForComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete' && !t.discarded) done();
    }, done);
  });
}

/** Activa cada pestaña un momento para capturarla y vuelve a la de origen. */
async function captureTabsNow(tabIds, returnTabId) {
  const results = {};
  for (const id of tabIds) {
    try {
      const tab = await chrome.tabs.update(id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await waitForComplete(id, 10000);
      await sleep(700);
      results[id] = await enqueueCapture(() => captureTab(id));
    } catch {
      results[id] = false;
    }
  }
  if (returnTabId) {
    const back = await chrome.tabs.update(returnTabId, { active: true }).catch(() => null);
    if (back) await chrome.windows.update(back.windowId, { focused: true });
  }
  return results;
}

// ---------- Limpieza ----------
// Capturas y scroll solo se guardan mientras haya una pestaña abierta con esa URL.

let cleanupTimer;
function scheduleCleanup() {
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(cleanup, 10000);
}

async function cleanup() {
  const tabs = await chrome.tabs.query({});
  const open = new Set(tabs.map((t) => normalizeUrl(t.url)).filter(Boolean));
  const keys = chrome.storage.local.getKeys
    ? await chrome.storage.local.getKeys()
    : Object.keys(await chrome.storage.local.get(null));
  const stale = keys.filter((k) => /^(shot|scroll):/.test(k) && !open.has(k.slice(k.indexOf(':') + 1)));
  if (stale.length) await chrome.storage.local.remove(stale);
}

// ---------- Eventos ----------

chrome.tabs.onCreated.addListener(scheduleBadge);
chrome.tabs.onRemoved.addListener((_id, info) => {
  scheduleBadge();
  // Al cerrar el navegador no se limpia: las pestañas se restaurarán.
  if (!info.isWindowClosing) scheduleCleanup();
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.title) scheduleBadge();
  if (info.url) scheduleCleanup();
  if (info.status === 'complete' && tab.active) scheduleAutoCapture(tabId);
});
chrome.tabs.onActivated.addListener(({ tabId }) => scheduleAutoCapture(tabId));

chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(async () => {
  updateBadge();
  // Los content scripts del manifest no entran en pestañas ya abiertas.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    if (tab.discarded) continue;
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/scroll.js'] }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'scroll') {
    const norm = normalizeUrl(msg.url);
    if (norm && sender.tab) {
      chrome.storage.local.set({ [scrollKey(norm)]: { pct: msg.pct, y: msg.y, t: Date.now() } });
    }
    return false;
  }
  if (msg?.type === 'captureTabs') {
    captureTabsNow(msg.tabIds, msg.returnTabId).then(sendResponse);
    return true;
  }
  return false;
});
