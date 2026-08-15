import type { ConfigTab } from '@/pages/api-edit/ConfigNav';

export type ApiEditPrefs = {
  showSwitcher: boolean;
  tab: ConfigTab;
};

export type FeatureVisibility = {
  callback: boolean;
  datalink: boolean;
  script: boolean;
};

export type FeatureVisibilityPrefs = {
  visibility: FeatureVisibility;
};

const STORAGE_KEY = 'mockhub:api-edit:prefs';
const VISIBILITY_KEY = 'mockhub:api-edit:feature-visibility';

const DEFAULTS: ApiEditPrefs = {
  showSwitcher: true,
  tab: 'basic',
};

const VISIBILITY_DEFAULTS: FeatureVisibility = {
  callback: true,
  datalink: true,
  script: true,
};

function isConfigTab(value: unknown): value is ConfigTab {
  return (
    value === 'basic' ||
    value === 'params' ||
    value === 'response' ||
    value === 'callback' ||
    value === 'datalink' ||
    value === 'script' ||
    value === 'test'
  );
}

export function loadApiEditPrefs(): ApiEditPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ApiEditPrefs>;
    return {
      showSwitcher:
        typeof parsed.showSwitcher === 'boolean' ? parsed.showSwitcher : DEFAULTS.showSwitcher,
      tab: isConfigTab(parsed.tab) ? parsed.tab : DEFAULTS.tab,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveApiEditPrefs(prefs: Partial<ApiEditPrefs>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadApiEditPrefs();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {
    // localStorage 不可用时静默失败（隐私模式、配额超出等）
  }
}

export function loadFeatureVisibility(): FeatureVisibility {
  if (typeof window === 'undefined') return VISIBILITY_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return VISIBILITY_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<FeatureVisibility>;
    return {
      callback:
        typeof parsed.callback === 'boolean' ? parsed.callback : VISIBILITY_DEFAULTS.callback,
      datalink:
        typeof parsed.datalink === 'boolean' ? parsed.datalink : VISIBILITY_DEFAULTS.datalink,
      script: typeof parsed.script === 'boolean' ? parsed.script : VISIBILITY_DEFAULTS.script,
    };
  } catch {
    return VISIBILITY_DEFAULTS;
  }
}

export function saveFeatureVisibility(next: Partial<FeatureVisibility>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadFeatureVisibility();
    window.localStorage.setItem(VISIBILITY_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // 静默失败
  }
}
