// Configuration store - manages AI model configurations
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelConfig } from '../types';

interface ConfigState {
  configs: ModelConfig[];
  currentConfigId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setConfigs: (configs: ModelConfig[]) => void;
  addConfig: (config: ModelConfig) => void;
  updateConfig: (id: string, updates: Partial<ModelConfig>) => void;
  deleteConfig: (id: string) => void;
  setCurrentConfig: (id: string | null) => void;
  setDefault: (id: string) => void;
  reorderConfigs: (fromIndex: number, toIndex: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      configs: [],
      currentConfigId: null,
      isLoading: false,
      error: null,

      setConfigs: (configs) => set({ configs }),
      
      addConfig: (config) => set((state) => ({
        configs: [...state.configs, config]
      })),
      
      updateConfig: (id, updates) => set((state) => ({
        configs: state.configs.map((c) => 
          c.id === id ? { ...c, ...updates } : c
        )
      })),
      
      deleteConfig: (id) => set((state) => ({
        configs: state.configs.filter((c) => c.id !== id),
        currentConfigId: state.currentConfigId === id ? null : state.currentConfigId
      })),
      
      setCurrentConfig: (id) => set({ currentConfigId: id }),
      
      setDefault: (id) => set((state) => ({
        configs: state.configs.map((c) => ({
          ...c,
          isDefault: c.id === id
        }))
      })),
      
      // Reorder configs by moving item from fromIndex to toIndex
      reorderConfigs: (fromIndex, toIndex) => set((state) => {
        const newConfigs = [...state.configs];
        const [movedItem] = newConfigs.splice(fromIndex, 1);
        newConfigs.splice(toIndex, 0, movedItem);
        return { configs: newConfigs };
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'multi-ai-chat-config-store',
      // Only persist currentConfigId for config restoration
      partialize: (state) => ({ currentConfigId: state.currentConfigId }),
    }
  )
);

// Selector helpers
export const getCurrentConfig = (state: ConfigState): ModelConfig | undefined => {
  return state.configs.find((c) => c.id === state.currentConfigId);
};

export const getDefaultConfig = (state: ConfigState): ModelConfig | undefined => {
  return state.configs.find((c) => c.isDefault);
};
