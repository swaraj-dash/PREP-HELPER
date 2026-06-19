import { create } from 'zustand'

export const useAppStore = create((set) => ({
  vaultConfigured: false,
  vaultPath: null,
  activeProvider: null, // 'gemini' | 'groq' | 'openai'
  activeModel: null,
  providersConfigured: [],

  setVaultConfigured: (configured) => set({ vaultConfigured: configured }),
  
  setSettings: (settings) => set({
    vaultPath: settings.vault_path,
    vaultConfigured: settings.vault_configured,
    providersConfigured: settings.providers_configured || [],
    activeProvider: settings.providers_configured && settings.providers_configured.length > 0 ? settings.providers_configured[0] : null,
    activeModel: settings.model_prefs ? settings.model_prefs.extraction : null,
  }),
}))
