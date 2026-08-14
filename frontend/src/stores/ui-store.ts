import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

type UiState = {
  selectedProjectId: number | null;
  selectedFeatureGroupId: number | null;
  sidebarCollapsed: boolean;
  theme: Theme;

  setSelectedProject: (id: number | null) => void;
  setSelectedFeatureGroup: (id: number | null) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

function applyThemeClass(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // 添加 theme-ready 标记，开启全局过渡
  if (!root.classList.contains('theme-ready')) {
    // 使用 rAF 确保首帧不参与过渡，避免初始化抖动
    requestAnimationFrame(() => {
      root.classList.add('theme-ready');
    });
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      selectedProjectId: null,
      selectedFeatureGroupId: null,
      sidebarCollapsed: false,
      theme: 'light',

      setSelectedProject: (id) => set({ selectedProjectId: id, selectedFeatureGroupId: null }),
      setSelectedFeatureGroup: (id) => set({ selectedFeatureGroupId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => {
        set({ theme });
        applyThemeClass(theme);
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        applyThemeClass(next);
      },
    }),
    {
      name: 'mockhub-ui',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
