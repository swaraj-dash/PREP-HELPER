import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Check, X, Shield, Key, FolderOpen, Save, RefreshCw } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { getSettings, saveSettings, testApiKey, setupVault } from '../api/client'

export default function Settings() {
  const store = useAppStore()

  const [vaultPath, setVaultPath] = useState('')

  // API Keys state
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    groq: '',
    openai: '',
  })
  const [isSettingUpVault, setIsSettingUpVault] = useState(false)

  // Model preferences state
  const [modelPrefs, setModelPrefs] = useState({
    extraction: 'gemini-1.5-flash',
    tagging: 'gemini-1.5-flash',
    reasoning: 'gemini-1.5-pro',
  })

  // Test key status
  const [testStatus, setTestStatus] = useState({
    gemini: { status: 'idle', error: '' }, // 'idle' | 'testing' | 'success' | 'error'
    groq: { status: 'idle', error: '' },
    openai: { status: 'idle', error: '' },
  })

  useEffect(() => {
    // Load existing settings
    getSettings()
      .then((res) => {
        if (res.data) {
          const data = res.data
          setVaultPath(data.vault_path || '')
          setApiKeys({
            gemini: data.providers_configured.includes('gemini') ? '***' : '',
            groq: data.providers_configured.includes('groq') ? '***' : '',
            openai: data.providers_configured.includes('openai') ? '***' : '',
          })
          if (data.model_prefs && Object.keys(data.model_prefs).length > 0) {
            setModelPrefs(data.model_prefs)
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err)
      })
  }, [])

  const handleVaultSetup = async (e) => {
    e.preventDefault()
    if (!vaultPath.trim()) {
      toast.error('Vault path cannot be empty.')
      return
    }

    setIsSettingUpVault(true)
    try {
      const res = await setupVault(vaultPath)
      if (res.data && res.data.success) {
        toast.success(`Vault successfully initialized at: ${vaultPath}`)
        store.setVaultConfigured(true)
        // Refresh settings
        const settingsRes = await getSettings()
        store.setSettings(settingsRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSettingUpVault(false)
    }
  }

  const handleTestKey = async (provider) => {
    const key = apiKeys[provider]
    if (!key) {
      toast.error(`Please enter an API key for ${provider} first.`)
      return
    }

    setTestStatus((prev) => ({
      ...prev,
      [provider]: { status: 'testing', error: '' },
    }))

    try {
      const res = await testApiKey({ provider, api_key: key })
      if (res.data && res.data.valid) {
        setTestStatus((prev) => ({
          ...prev,
          [provider]: { status: 'success', error: '' },
        }))
        toast.success(`${provider.toUpperCase()} API key is valid!`)
      } else {
        setTestStatus((prev) => ({
          ...prev,
          [provider]: { status: 'error', error: res.data.error || 'Invalid key.' },
        }))
        toast.error(`${provider.toUpperCase()} verification failed.`)
      }
    } catch (err) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { status: 'error', error: err.message || 'Error occurred.' },
      }))
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      const res = await saveSettings({
        api_keys: apiKeys,
        model_prefs: modelPrefs,
      })
      if (res.data) {
        toast.success('Configuration saved successfully.')
        store.setSettings(res.data)
        // Mask keys in UI
        setApiKeys({
          gemini: res.data.providers_configured.includes('gemini') ? '***' : '',
          groq: res.data.providers_configured.includes('groq') ? '***' : '',
          openai: res.data.providers_configured.includes('openai') ? '***' : '',
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Configuration Settings</h1>
        <p className="text-slate-400 mt-1">Manage your local storage directory and AI integrations.</p>
      </div>

      {/* Vault Setup Section */}
      <section className="glow-card rounded-2xl p-6 bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-3 text-white">
          <FolderOpen className="h-6 w-6 text-indigo-400" />
          <h2 className="text-xl font-bold">1. Local Vault Directory</h2>
        </div>
        <p className="text-sm text-slate-400">
          Enter an absolute folder path on your computer. All processed files, database entries, logs, and indexes will reside inside this vault directory.
        </p>

        <form onSubmit={handleVaultSetup} className="flex space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="e.g. D:\PrepVault or /users/name/prep-vault"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {store.vaultConfigured && (
              <span className="absolute right-4 top-3.5 flex items-center text-emerald-400 text-xs font-semibold space-x-1">
                <Check className="h-4 w-4" />
                <span>Configured</span>
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSettingUpVault}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-2"
          >
            {isSettingUpVault ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <span>Initialize Vault</span>
            )}
          </button>
        </form>
      </section>

      {/* AI Credentials Form */}
      <form onSubmit={handleSaveSettings} className="space-y-8">
        <section className="glow-card rounded-2xl p-6 bg-slate-900/40 border border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-white">
            <Key className="h-6 w-6 text-indigo-400" />
            <h2 className="text-xl font-bold">2. AI API Integration (Bring Your Own Key)</h2>
          </div>
          <p className="text-sm text-slate-400">
            Keys are encrypted using a machine-local key and stored in <code>~/.prephelper/config.json</code>. They are never sent to external servers except direct API requests.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gemini */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4 relative flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Google Gemini</h3>
                <p className="text-xs text-slate-500 mt-1">Recommended extraction model.</p>
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-400 font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                    placeholder={apiKeys.gemini === '***' ? '••••••••••••' : 'Enter API Key'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleTestKey('gemini')}
                  disabled={testStatus.gemini.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
                >
                  {testStatus.gemini.status === 'testing' ? 'Verifying...' : 'Verify Key'}
                </button>
                {testStatus.gemini.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                {testStatus.gemini.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
              </div>
              {testStatus.gemini.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.gemini.error}</p>
              )}
            </div>

            {/* Groq */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4 relative flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Groq</h3>
                <p className="text-xs text-slate-500 mt-1">Ultra-fast completion processing.</p>
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-400 font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKeys.groq}
                    onChange={(e) => setApiKeys({ ...apiKeys, groq: e.target.value })}
                    placeholder={apiKeys.groq === '***' ? '••••••••••••' : 'Enter API Key'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleTestKey('groq')}
                  disabled={testStatus.groq.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
                >
                  {testStatus.groq.status === 'testing' ? 'Verifying...' : 'Verify Key'}
                </button>
                {testStatus.groq.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                {testStatus.groq.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
              </div>
              {testStatus.groq.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.groq.error}</p>
              )}
            </div>

            {/* OpenAI */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4 relative flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">OpenAI</h3>
                <p className="text-xs text-slate-500 mt-1">High-quality parsing and reasoning.</p>
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-400 font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                    placeholder={apiKeys.openai === '***' ? '••••••••••••' : 'Enter API Key'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleTestKey('openai')}
                  disabled={testStatus.openai.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
                >
                  {testStatus.openai.status === 'testing' ? 'Verifying...' : 'Verify Key'}
                </button>
                {testStatus.openai.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                {testStatus.openai.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
              </div>
              {testStatus.openai.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.openai.error}</p>
              )}
            </div>
          </div>
        </section>

        {/* Model Preferences Section */}
        <section className="glow-card rounded-2xl p-6 bg-slate-900/40 border border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-white">
            <Shield className="h-6 w-6 text-indigo-400" />
            <h2 className="text-xl font-bold">3. Model Task Mapping</h2>
          </div>
          <p className="text-sm text-slate-400">
            Define which model performs which task during document ingestion to optimize for cost and speed.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Extraction */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-semibold block">Extraction Model (Fast/Cheap)</label>
              <select
                value={modelPrefs.extraction}
                onChange={(e) => setModelPrefs({ ...modelPrefs, extraction: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (Groq)</option>
              </select>
            </div>

            {/* Tagging */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-semibold block">Tagging Model (Balanced)</label>
              <select
                value={modelPrefs.tagging}
                onChange={(e) => setModelPrefs({ ...modelPrefs, tagging: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gemma-2-9b-it">Gemma 2 9B (Groq)</option>
              </select>
            </div>

            {/* Reasoning */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-semibold block">Reasoning Model (Capable)</label>
              <select
                value={modelPrefs.reasoning}
                onChange={(e) => setModelPrefs({ ...modelPrefs, reasoning: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Groq)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-2"
          >
            <Save className="h-5 w-5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  )
}
