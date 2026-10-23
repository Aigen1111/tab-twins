import { groupDuplicates } from '../lib/grouping.js';
import { localizePage, t, tn } from '../lib/i18n.js';
import { escapeHtml, focusTab, loadSnapshot, matchesQuery, openManager } from '../lib/tabs.js';

const MAX_RESULTS = 50;
const MAX_GROUPS = 8;

const $search = document.getElementById('search');
const $current = document.getElementById('current');
const $summary = document.getElementById('summary');
const $results = document.getElementById('results');

let snapshot;
let groups = [];
let items = []; // lo que hay en la lista ahora, para el teclado
let cursor = 0;

const favicon = (tab) =>
  tab.favIconUrl && /^https?:|^data:/.test(tab.favIconUrl)
    ? `<img class="fav" src="${escapeHtml(tab.favIconUrl)}" alt="">`
    : '<span class="fav fav-empty"></span>';

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function windowLabel(tab) {
  const label = snapshot.windowLabels.get(tab.windowId) ?? '';
  return tab.windowId === snapshot.currentWindowId ? t('windowThis', label) : label;
}

function renderCurrent() {
  const [active] = snapshot.tabs.filter((t) => t.active && t.windowId === snapshot.currentWindowId);
  const group = active && groups.find((g) => g.tabs.some((t) => t.id === active.id));
  $current.hidden = !group;
  if (!group) return;
  const others = group.tabs.length - 1;
  $current.innerHTML = `
    <div class="notice">
      <span>${tn('currentTwins', others)}</span>
      <button class="btn small" data-compare="${active.id}">${t('compare')}</button>
    </div>`;
}

function renderGroups() {
  const extra = groups.reduce((n, g) => n + g.tabs.length - 1, 0);
  $summary.innerHTML = groups.length
    ? `<p class="muted">${tn('groupsOfDupes', groups.length)} · ${tn('extraTabs', extra)}</p>`
    : `<p class="muted">${t('noDuplicatesAmong', snapshot.tabs.length)}</p>`;

  items = groups.slice(0, MAX_GROUPS).map((g) => ({ type: 'group', group: g }));
  $results.innerHTML = items
    .map(({ group: g }, i) => `
      <li class="row ${i === cursor ? 'is-cursor' : ''}" data-index="${i}" role="option">
        ${favicon(g.tabs[0])}
        <div class="row-main">
          <div class="row-title">${escapeHtml(g.label)}</div>
          <div class="row-meta">${escapeHtml(g.host)} · ${tn('tabsCount', g.tabs.length)} · ${t(g.kind === 'exact' ? 'kindExactLower' : 'kindSimilarLower')}</div>
        </div>
        <span class="chip">${t('compare')}</span>
      </li>`)
    .join('');
}

function renderSearch(query) {
  const found = snapshot.tabs.filter((t) => matchesQuery(t, query)).slice(0, MAX_RESULTS);
  $summary.innerHTML = `<p class="muted">${found.length === MAX_RESULTS ? t('resultsMore', MAX_RESULTS) : tn('results', found.length)}</p>`;
  const twinIds = new Set(groups.flatMap((g) => g.tabs.map((t) => t.id)));

  items = found.map((tab) => ({ type: 'tab', tab }));
  $results.innerHTML = items
    .map(({ tab }, i) => `
      <li class="row ${i === cursor ? 'is-cursor' : ''}" data-index="${i}" role="option">
        ${favicon(tab)}
        <div class="row-main">
          <div class="row-title">${escapeHtml(tab.title || tab.url)}</div>
          <div class="row-meta">${escapeHtml(host(tab.url))} · ${escapeHtml(windowLabel(tab))}</div>
        </div>
        ${twinIds.has(tab.id) ? `<span class="chip warn">${t('duplicateChip')}</span>` : ''}
      </li>`)
    .join('');
}

function render() {
  const query = $search.value.trim();
  if (query) renderSearch(query);
  else renderGroups();
}

async function activate(index) {
  const item = items[index];
  if (!item) return;
  if (item.type === 'tab') await focusTab(item.tab);
  else await openManager(`?compare=${item.group.tabs[0].id}`);
  window.close();
}

$search.addEventListener('input', () => {
  cursor = 0;
  render();
});

$search.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    render();
    $results.querySelector('.is-cursor')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    activate(cursor);
  }
});

$results.addEventListener('click', (e) => {
  const row = e.target.closest('[data-index]');
  if (row) activate(Number(row.dataset.index));
});

$current.addEventListener('click', async (e) => {
  const id = e.target.closest('[data-compare]')?.dataset.compare;
  if (!id) return;
  await openManager(`?compare=${id}`);
  window.close();
});

document.getElementById('open-manager').addEventListener('click', async () => {
  await openManager();
  window.close();
});

localizePage();
snapshot = await loadSnapshot();
groups = groupDuplicates(snapshot.tabs);
renderCurrent();
render();
