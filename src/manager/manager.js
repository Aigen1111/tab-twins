import { KEEP_RULES, duplicatesToClose, groupDuplicates, normalizeUrl, pickKeeper } from '../lib/grouping.js';
import { localizePage, t, tn } from '../lib/i18n.js';
import { getSettings, saveSettings, scrollKey, shotKey } from '../lib/store.js';
import {
  GROUP_COLORS,
  closeTabs,
  escapeHtml as h,
  focusTab,
  hasSiteAccess,
  loadSnapshot,
  matchesQuery,
  readLiveScroll,
  reopenTabs,
  requestSiteAccess,
  timeAgo,
} from '../lib/tabs.js';

const $ = (id) => document.getElementById(id);
const $groups = $('groups');
const $compare = $('compare');
const $confirm = $('confirm');
const $toast = $('toast');

const state = {
  snap: null,
  groups: [], // grupos tras filtrar por ventana / grupo de pestañas
  visible: [], // además filtrados por tipo y texto
  selected: new Set(),
  filters: { windowId: 'all', tabGroup: 'all', kind: 'all', q: '' },
  settings: null,
  scroll: {}, // norm -> { pct, y, t }
  live: {}, // tabId -> scroll leído ahora mismo
  compareIds: null, // ids de las pestañas del grupo que se está comparando
  myTabId: null,
};

// ---------- Datos ----------

function filterTabs(tabs) {
  const { windowId, tabGroup } = state.filters;
  return tabs.filter((t) => {
    if (windowId !== 'all' && t.windowId !== Number(windowId)) return false;
    if (tabGroup === 'none' && t.groupId !== -1) return false;
    if (tabGroup !== 'all' && tabGroup !== 'none' && t.groupId !== Number(tabGroup)) return false;
    return true;
  });
}

function recompute() {
  state.groups = groupDuplicates(filterTabs(state.snap.tabs));
  const { kind, q } = state.filters;
  state.visible = state.groups.filter(
    (g) => (kind === 'all' || g.kind === kind) && (!q || matchesQuery({ title: g.label, url: g.host }, q) || g.tabs.some((t) => matchesQuery(t, q))),
  );
  const visibleIds = new Set(state.visible.flatMap((g) => g.tabs.map((t) => t.id)));
  for (const id of state.selected) if (!visibleIds.has(id)) state.selected.delete(id);
}

async function refresh() {
  state.snap = await loadSnapshot();
  const keys = [...new Set(state.snap.tabs.map((t) => normalizeUrl(t.url)))].map(scrollKey);
  const stored = keys.length ? await chrome.storage.local.get(keys) : {};
  state.scroll = Object.fromEntries(Object.entries(stored).map(([k, v]) => [k.slice('scroll:'.length), v]));
  recompute();
  render();
}

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 350);
}

const rule = () => state.settings.keepRule;
const tabById = (id) => state.snap.tabs.find((t) => t.id === id);

// ---------- Render: lista ----------

function favicon(tab) {
  return tab.favIconUrl && /^https?:|^data:/.test(tab.favIconUrl)
    ? `<img class="fav" src="${h(tab.favIconUrl)}" alt="">`
    : '<span class="fav fav-empty"></span>';
}

function tabGroupChip(tab) {
  const g = state.snap.groupsById.get(tab.groupId);
  if (!g) return '';
  return `<span class="tg"><span class="tg-dot" style="background:${GROUP_COLORS[g.color] ?? GROUP_COLORS.grey}"></span>${h(g.title || t('unnamedGroup'))}</span>`;
}

function scrollOf(tab) {
  return state.live[tab.id] ?? state.scroll[normalizeUrl(tab.url)] ?? null;
}

function windowLabel(tab) {
  const label = state.snap.windowLabels.get(tab.windowId) ?? t('ariaWindow');
  return tab.windowId === state.snap.currentWindowId ? t('windowThis', label) : label;
}

// En un grupo de "misma obra", pestañas con exactamente la misma URL.
function repeatedNorms(group) {
  const seen = new Map();
  for (const t of group.tabs) seen.set(t.norm, (seen.get(t.norm) ?? 0) + 1);
  return new Set(group.kind === 'similar' ? [...seen].filter(([, n]) => n > 1).map(([norm]) => norm) : []);
}
const repeatedChip = () => `<span class="chip warn" title="${h(t('repeatedTitle'))}">${t('repeated')}</span>`;

function tabRow(tab, isKeeper, isRepeated) {
  const scroll = scrollOf(tab);
  const meta = [
    tab.chapter != null ? `<strong>${t('chapterShort', tab.chapter)}</strong>` : tab.workPage ? `<strong>${t('workPage')}</strong>` : '',
    h(windowLabel(tab)),
    tabGroupChip(tab),
    t('visited', timeAgo(tab.lastAccessed)),
    scroll ? t('readPct', scroll.pct) : '',
    tab.pinned ? t('pinned') : '',
    tab.discarded ? t('discarded') : '',
  ].filter(Boolean);

  return `
    <li class="tab-row ${state.selected.has(tab.id) ? 'is-selected' : ''}" data-tab="${tab.id}">
      <input type="checkbox" data-action="select-tab" aria-label="${h(t('select'))}" ${state.selected.has(tab.id) ? 'checked' : ''}>
      ${favicon(tab)}
      <div class="row-main">
        <a href="${h(tab.url)}" class="row-title" data-action="go" title="${h(tab.url)}">${h(tab.title || tab.url)}</a>
        <div class="row-meta">${meta.join('<span class="sep">·</span>')}</div>
      </div>
      ${isRepeated ? repeatedChip() : ''}
      ${isKeeper ? `<span class="chip ok" title="${h(t('keptTitle'))}">${t('kept')}</span>` : ''}
      <button class="btn small" data-action="go">${t('go')}</button>
      <button class="btn small danger" data-action="close-tab">${t('close')}</button>
    </li>`;
}

function groupCard(g) {
  const keeper = pickKeeper(g.tabs, rule());
  const closable = duplicatesToClose(g, rule()).length;
  const allSelected = g.tabs.every((t) => state.selected.has(t.id));
  const repeated = repeatedNorms(g);
  return `
    <article class="group" data-group="${g.id}">
      <header class="group-head">
        <input type="checkbox" data-action="select-group" aria-label="${h(t('selectGroup'))}" ${allSelected ? 'checked' : ''}>
        <div class="group-title">
          <h2>${h(g.label)}</h2>
          <div class="muted">${h(g.host)} · ${tn('tabsCount', g.tabs.length)}</div>
        </div>
        <span class="chip ${g.kind === 'exact' ? 'warn' : ''}">${t(g.kind === 'exact' ? 'kindExact' : 'kindSimilar')}</span>
        <button class="btn small" data-action="compare">${t('compare')}</button>
        <button class="btn small danger" data-action="close-group-dupes" ${closable ? '' : 'disabled'}>${t('closeGroupDupes', closable)}</button>
      </header>
      <ul class="list">${g.tabs.map((t) => tabRow(t, t.id === keeper.id, repeated.has(t.norm))).join('')}</ul>
    </article>`;
}

function renderFilters() {
  const { snap, filters } = state;
  const counts = new Map();
  for (const t of snap.tabs) counts.set(t.windowId, (counts.get(t.windowId) ?? 0) + 1);

  const winOptions = [['all', t('allWindows')]].concat(
    snap.windows.map((w) => [String(w.id), `${windowLabel({ windowId: w.id })} · ${tn('tabsCount', counts.get(w.id) ?? 0)}`]),
  );
  const groupOptions = [['all', t('allTabGroups')], ['none', t('noTabGroup')]].concat(
    snap.tabGroups.map((g) => [String(g.id), `${g.title || t('unnamedGroup')} · ${snap.windowLabels.get(g.windowId) ?? ''}`]),
  );

  const fill = (select, options, key) => {
    if (!options.some(([v]) => v === filters[key])) filters[key] = 'all';
    select.innerHTML = options.map(([v, label]) => `<option value="${v}" ${v === filters[key] ? 'selected' : ''}>${h(label)}</option>`).join('');
  };
  fill($('f-window'), winOptions, 'windowId');
  fill($('f-tabgroup'), groupOptions, 'tabGroup');
}

function render() {
  renderFilters();
  const total = state.snap.tabs.length;
  const dupeIds = state.visible.flatMap((g) => duplicatesToClose(g, rule()));
  const extra = state.groups.reduce((n, g) => n + g.tabs.length - 1, 0);

  $('stats').textContent = state.groups.length
    ? `${tn('groupsOfDupes', state.groups.length)} · ${t('statsExtra', extra)} · ${tn('openTabs', total)}`
    : `${t('statsNone')} · ${tn('openTabs', total)}`;

  $('close-selected').textContent = t('closeSelected', state.selected.size);
  $('close-selected').disabled = state.selected.size === 0;
  $('close-all-dupes').textContent = t('closeAllDupes', dupeIds.length);
  $('close-all-dupes').disabled = dupeIds.length === 0;

  if (state.visible.length) {
    $groups.innerHTML = state.visible.map(groupCard).join('');
  } else {
    const filtered = state.filters.q || state.filters.kind !== 'all' || state.filters.windowId !== 'all' || state.filters.tabGroup !== 'all';
    $groups.innerHTML = `
      <div class="empty">
        <p><strong>${t(filtered ? 'emptyFilteredTitle' : 'emptyTitle')}</strong></p>
        <p class="muted">${t(filtered ? 'emptyFilteredHint' : 'emptyHint')}</p>
      </div>`;
  }

  if (state.compareIds) renderCompare();
}

// ---------- Render: comparar ----------

function compareGroup() {
  const ids = new Set(state.compareIds);
  const inGroup = (g) => g.tabs.some((t) => ids.has(t.id));
  // Si un filtro la oculta, se busca entre todas las pestañas.
  return state.groups.find(inGroup) ?? groupDuplicates(state.snap.tabs).find(inGroup) ?? null;
}

let compareToken = 0;
async function renderCompare() {
  const token = ++compareToken;
  const g = compareGroup();
  if (!g) {
    closeCompare();
    if (state.compareIds) showToast(t('noDupesLeft'));
    return;
  }
  state.compareIds = g.tabs.map((t) => t.id);

  const shotKeys = g.tabs.map((t) => shotKey(t.norm));
  const shots = await chrome.storage.local.get(shotKeys);
  if (token !== compareToken) return;

  const keeper = pickKeeper(g.tabs, rule());
  const maxChapter = Math.max(...g.tabs.map((t) => t.chapter ?? -Infinity));
  const maxVisit = Math.max(...g.tabs.map((t) => t.lastAccessed ?? 0));
  const maxScroll = Math.max(...g.tabs.map((t) => scrollOf(t)?.pct ?? -1));
  const chaptersDiffer = new Set(g.tabs.map((t) => t.chapter)).size > 1;
  const repeated = repeatedNorms(g);

  const column = (tab) => {
    const shot = shots[shotKey(tab.norm)];
    const scroll = scrollOf(tab);
    return `
      <section class="cmp-col ${tab.id === keeper.id ? 'is-keeper' : ''}" data-tab="${tab.id}">
        <div class="shot">
          ${shot
            ? `<img src="${shot.data}" alt="${h(t('shotAlt'))}"><span class="shot-age">${t('shotAge', timeAgo(shot.t))}</span>`
            : `<div class="shot-empty"><span class="muted">${t('noShot')}</span><button class="btn small" data-action="capture-one">${t('capture')}</button></div>`}
        </div>
        <h3 class="cmp-title" title="${h(tab.title)}">${repeated.has(tab.norm) ? repeatedChip() + ' ' : ''}${h(tab.title || tab.url)}</h3>
        <a class="cmp-url" href="${h(tab.url)}" data-action="go" title="${h(tab.url)}">${h(tab.url)}</a>
        <dl class="cmp-facts">
          <dt>${t('factChapter')}</dt>
          <dd>${tab.chapter ?? (tab.workPage ? t('workPage') : '—')} ${chaptersDiffer && tab.chapter === maxChapter ? `<span class="chip ok">${t('mostAdvanced')}</span>` : ''}</dd>
          <dt>${t('factLastVisit')}</dt>
          <dd>${timeAgo(tab.lastAccessed)} ${g.tabs.length > 1 && tab.lastAccessed === maxVisit ? `<span class="chip ok">${t('mostRecent')}</span>` : ''}</dd>
          <dt>${t('factRead')}</dt>
          <dd>${scroll
            ? `<span class="bar"><span style="width:${scroll.pct}%"></span></span> ${t('pct', scroll.pct)}
               ${scroll.pct === maxScroll && maxScroll > 0 ? `<span class="chip ok">${t('mostRead')}</span>` : ''}
               <small class="muted">${scroll.live ? t('readNow') : t('readSaved', timeAgo(scroll.t))}</small>`
            : `<span class="muted">${t('noScrollData')}</span>`}</dd>
          <dt>${t('factLocation')}</dt>
          <dd>${h(windowLabel(tab))} ${tabGroupChip(tab)}${tab.pinned ? ` · ${t('pinned')}` : ''}${tab.discarded ? ` · ${t('discarded')}` : ''}</dd>
        </dl>
        <div class="cmp-actions">
          <button class="btn small" data-action="go">${t('go')}</button>
          <button class="btn small danger" data-action="close-tab">${t('closeThis')}</button>
          <button class="btn small primary" data-action="keep-only">${t('keepOnly')}</button>
        </div>
      </section>`;
  };

  $compare.innerHTML = `
    <div class="cmp-panel" role="dialog" aria-modal="true" aria-label="${h(t('compareAria'))}">
      <header class="cmp-head">
        <div>
          <h2>${h(g.label)}</h2>
          <p class="muted">${h(g.host)} · ${tn('tabsCount', g.tabs.length)} · ${t(g.kind === 'exact' ? 'kindExactLower' : 'kindSimilarLower')}</p>
        </div>
        <span class="spacer"></span>
        <button class="btn small" data-action="capture-all" title="${h(t('refreshShotsTitle'))}">${t('refreshShots')}</button>
        <button class="btn small" data-action="close-compare" aria-label="${h(t('closeCompareAria'))}">✕</button>
      </header>
      <div class="cmp-cols">${g.tabs.map(column).join('')}</div>
    </div>`;
  $compare.hidden = false;
}

async function openCompare(tabIds) {
  state.compareIds = tabIds;
  state.live = {};
  await renderCompare();
  // El scroll en vivo tarda un poco: se pinta primero con lo guardado.
  const tabs = tabIds.map(tabById).filter(Boolean);
  const results = await Promise.all(tabs.map(readLiveScroll));
  tabs.forEach((t, i) => {
    if (results[i]) state.live[t.id] = results[i];
  });
  if (state.compareIds) render();
}

function closeCompare() {
  state.compareIds = null;
  state.live = {};
  $compare.hidden = true;
  $compare.innerHTML = '';
}

async function captureNow(tabIds) {
  showToast(t('capturing'));
  await chrome.runtime.sendMessage({ type: 'captureTabs', tabIds, returnTabId: state.myTabId });
  showToast(t('capturesUpdated'));
  if (state.compareIds) openCompare(state.compareIds);
}

// ---------- Cerrar ----------

function confirmClose(tabs, { title, note } = {}) {
  const MAX_LISTED = 12;
  const listed = tabs.slice(0, MAX_LISTED);
  $confirm.innerHTML = `
    <form method="dialog">
      <h2>${h(title ?? tn('confirmClose', tabs.length))}</h2>
      ${note ? `<p class="muted">${note}</p>` : ''}
      <ul class="confirm-list">
        ${listed.map((tab) => `<li>${favicon(tab)}<span>${h(tab.title || tab.url)}</span>${tab.chapter != null ? `<small class="muted">${t('chapterShort', tab.chapter)}</small>` : ''}</li>`).join('')}
        ${tabs.length > MAX_LISTED ? `<li class="muted">${t('andMore', tabs.length - MAX_LISTED)}</li>` : ''}
      </ul>
      <p class="muted small">${t('undoHint')}</p>
      <div class="confirm-actions">
        <button class="btn" value="cancel">${t('cancel')}</button>
        <button class="btn primary" value="ok" autofocus>${t('confirmCloseN', tabs.length)}</button>
      </div>
    </form>`;
  // Al cerrar con Esc se mantiene el returnValue anterior: hay que vaciarlo.
  $confirm.returnValue = '';
  $confirm.showModal();
  return new Promise((resolve) => {
    $confirm.addEventListener('close', () => resolve($confirm.returnValue === 'ok'), { once: true });
  });
}

async function closeWithUndo(tabs) {
  if (!tabs.length) return;
  tabs.forEach((t) => state.selected.delete(t.id));
  const restore = await closeTabs(tabs);
  showToast(tn('closedTabs', tabs.length), {
    label: t('undo'),
    run: () => reopenTabs(restore),
  });
}

async function confirmAndClose(ids, options) {
  const tabs = ids.map(tabById).filter(Boolean);
  if (!tabs.length) return;
  if (await confirmClose(tabs, options)) await closeWithUndo(tabs);
}

const keepNote = (keepers) =>
  keepers.length === 1
    ? t('keepNoteOne', h(keepers[0].title))
    : t('keepNoteMany', h(t(KEEP_RULES[rule()])));

// ---------- Aviso con deshacer ----------

let toastTimer;
function showToast(text, action) {
  clearTimeout(toastTimer);
  $toast.innerHTML = `<span>${h(text)}</span>${action ? `<button class="btn small">${h(action.label)}</button>` : ''}`;
  $toast.hidden = false;
  if (action) {
    $toast.querySelector('button').addEventListener('click', async () => {
      $toast.hidden = true;
      await action.run();
    }, { once: true });
  }
  toastTimer = setTimeout(() => ($toast.hidden = true), action ? 12000 : 3500);
}

// ---------- Eventos ----------

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target === $compare) closeCompare();
    return;
  }
  const action = el.dataset.action;
  const tabId = Number(el.closest('[data-tab]')?.dataset.tab);
  const groupEl = el.closest('[data-group]');
  const group = groupEl && state.visible.find((g) => g.id === groupEl.dataset.group);
  const tab = tabId ? tabById(tabId) : null;

  switch (action) {
    case 'go':
      e.preventDefault();
      if (tab) await focusTab(tab);
      break;
    case 'select-tab':
      if (el.checked) state.selected.add(tabId);
      else state.selected.delete(tabId);
      render();
      break;
    case 'select-group':
      group?.tabs.forEach((t) => (el.checked ? state.selected.add(t.id) : state.selected.delete(t.id)));
      render();
      break;
    case 'close-tab':
      if (tab) await closeWithUndo([tab]);
      break;
    case 'compare':
      if (group) await openCompare(group.tabs.map((t) => t.id));
      break;
    case 'close-group-dupes':
      if (group) await confirmAndClose(duplicatesToClose(group, rule()), { note: keepNote([pickKeeper(group.tabs, rule())]) });
      break;
    case 'close-compare':
      closeCompare();
      break;
    case 'keep-only': {
      const g = compareGroup();
      if (!g || !tab) break;
      const others = g.tabs.filter((t) => t.id !== tab.id && !t.pinned).map((t) => t.id);
      await confirmAndClose(others, { note: keepNote([tab]) });
      break;
    }
    case 'capture-one':
      if (tab) await captureNow([tab.id]);
      break;
    case 'capture-all':
      if (state.compareIds) await captureNow(state.compareIds);
      break;
  }
});

$('close-selected').addEventListener('click', () =>
  confirmAndClose([...state.selected], { note: t('manualNote') }),
);

$('close-all-dupes').addEventListener('click', () => {
  const ids = state.visible.flatMap((g) => duplicatesToClose(g, rule()));
  const keepers = state.visible.map((g) => pickKeeper(g.tabs, rule()));
  confirmAndClose(ids, {
    title: t('confirmCloseAll', tn('dupes', ids.length), tn('groups', state.visible.length)),
    note: keepNote(keepers),
  });
});

$('q').addEventListener('input', (e) => {
  state.filters.q = e.target.value.trim();
  recompute();
  render();
});
for (const [id, key] of [['f-window', 'windowId'], ['f-tabgroup', 'tabGroup'], ['f-kind', 'kind']]) {
  $(id).addEventListener('change', (e) => {
    state.filters[key] = e.target.value;
    recompute();
    render();
  });
}
$('keep-rule').addEventListener('change', async (e) => {
  state.settings = await saveSettings({ keepRule: e.target.value });
  render();
});
$('auto-capture').addEventListener('change', async (e) => {
  state.settings = await saveSettings({ autoCapture: e.target.checked });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.compareIds && !$confirm.open) closeCompare();
});

chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onMoved.addListener(scheduleRefresh);
chrome.tabs.onAttached.addListener(scheduleRefresh);
chrome.tabs.onDetached.addListener(scheduleRefresh);
chrome.tabs.onActivated.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if ('url' in info || 'title' in info || 'pinned' in info || 'discarded' in info || 'groupId' in info) scheduleRefresh();
});
chrome.tabGroups?.onUpdated.addListener(scheduleRefresh);
chrome.windows.onCreated.addListener(scheduleRefresh);
chrome.windows.onRemoved.addListener(scheduleRefresh);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const keys = Object.keys(changes);
  if (keys.some((k) => k.startsWith('scroll:'))) scheduleRefresh();
  else if (state.compareIds && keys.some((k) => k.startsWith('shot:'))) renderCompare();
});

// ---------- Acceso a las webs ----------

async function renderAccess() {
  $('access').hidden = await hasSiteAccess();
}

$('grant-access').addEventListener('click', async () => {
  if (await requestSiteAccess()) {
    $('access').hidden = true;
    showToast(t('accessGranted'));
  }
});
chrome.permissions.onAdded.addListener(renderAccess);
chrome.permissions.onRemoved.addListener(renderAccess);

// ---------- Inicio ----------

localizePage();
state.settings = await getSettings();
state.myTabId = (await chrome.tabs.getCurrent())?.id ?? null;
$('keep-rule').innerHTML = Object.entries(KEEP_RULES)
  .map(([v, key]) => `<option value="${v}" ${v === state.settings.keepRule ? 'selected' : ''}>${h(t(key))}</option>`)
  .join('');
$('auto-capture').checked = state.settings.autoCapture;

await renderAccess();
await refresh();

const compareParam = Number(new URLSearchParams(location.search).get('compare'));
if (compareParam) {
  history.replaceState(null, '', location.pathname);
  const g = groupDuplicates(state.snap.tabs).find((x) => x.tabs.some((t) => t.id === compareParam));
  if (g) await openCompare(g.tabs.map((t) => t.id));
}
