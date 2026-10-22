// Claves y ajustes en chrome.storage.local.
// Las capturas y el scroll se guardan por URL normalizada y se borran
// cuando ya no hay ninguna pestaña abierta con esa URL (ver background.js).

export const shotKey = (norm) => `shot:${norm}`;
export const scrollKey = (norm) => `scroll:${norm}`;

const DEFAULT_SETTINGS = {
  autoCapture: true,
  keepRule: 'chapter',
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings });
  return settings;
}
