// Textos de la interfaz con chrome.i18n (idioma del navegador; inglés por defecto).
// Los textos se definen en scripts/locales.mjs.

/** Texto traducido; si falta la clave, devuelve la clave para que se note. */
export function t(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

/** Plural: usa `${key}_one` o `${key}_other`; el número va como $1. */
export function tn(key, count, ...subs) {
  return t(`${key}_${count === 1 ? 'one' : 'other'}`, count, ...subs);
}

export const uiLanguage = () => chrome.i18n.getUILanguage();

/**
 * Traduce el HTML estático:
 * data-i18n (texto), data-i18n-placeholder, data-i18n-title, data-i18n-aria (aria-label).
 */
export function localizePage(root = document) {
  document.documentElement.lang = uiLanguage();
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
