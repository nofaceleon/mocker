import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  selectedProjectId: number | null;
  selectedFeatureGroupId: number | null;
  sidebarCollapsed: boolean;

  setSelectedProject: (id: number | null) => void;
  setSelectedFeatureGroup: (id: number | null) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedFeatureGroupId: null,
      sidebarCollapsed: false,

      setSelectedProject: (id) => set({ selectedProjectId: id, selectedFeatureGroupId: null }),
      setSelectedFeatureGroup: (id) => set({ selectedFeatureGroupId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'mockhub-ui' },
  ),
);
