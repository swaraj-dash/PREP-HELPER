import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Check, X, Shield, Key, FolderOpen, Save, RefreshCw, Trash2 } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { getSettings, saveSettings, testApiKey, setupVault } from '../api/client'

const RECOMMENDED_MODELS = {
  extraction: [
    'groq:llama-3.3-70b-versatile',
    'groq:gemma2-9b-it',
    'nvidia:meta/llama-3.3-70b-instruct',
    'nvidia:google/gemma-2-9b-it',
    'openrouter:google/gemini-2.5-flash',
    'openrouter:openai/gpt-4o-mini',
    'openrouter:meta-llama/llama-3.3-70b-instruct'
  ],
  tagging: [
    'groq:llama-3.3-70b-versatile',
    'nvidia:meta/llama-3.3-70b-instruct',
    'openrouter:google/gemini-2.5-flash',
    'openrouter:anthropic/claude-3-haiku'
  ],
  reasoning: [
    'groq:llama-3.3-70b-versatile',
    'nvidia:nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia:mistralai/mistral-large-2-instruct',
    'openrouter:anthropic/claude-3.5-sonnet',
    'openrouter:google/gemini-2.5-pro',
    'openrouter:deepseek/deepseek-chat'
  ]
}

export default function Settings() {
  const store = useAppStore()

  const [vaultPath, setVaultPath] = useState('')
  const [isSettingUpVault, setIsSettingUpVault] = useState(false)

  // API Keys state (Groq, Nvidia, OpenRouter only)
  const [apiKeys, setApiKeys] = useState({
    groq: '',
    nvidia: '',
    openrouter: '',
  })

  // Model preferences state
  const [modelPrefs, setModelPrefs] = useState({
    extraction: '',
    tagging: '',
    reasoning: '',
  })

  // Available models mapping from active/verified providers
  const [availableModels, setAvailableModels] = useState({
    groq: [],
    nvidia: [],
    openrouter: [],
  })

  // Test key status
  const [testStatus, setTestStatus] = useState({
    groq: { status: 'idle', error: '' }, // 'idle' | 'testing' | 'success' | 'error'
    nvidia: { status: 'idle', error: '' },
    openrouter: { status: 'idle', error: '' },
  })

  // API limits info
  const [limits, setLimits] = useState({})

  useEffect(() => {
    // Load existing settings
    getSettings()
      .then((res) => {
        if (res.data) {
          const data = res.data
          setVaultPath(data.vault_path || '')
          setApiKeys({
            groq: data.providers_configured.includes('groq') ? '***' : '',
            nvidia: data.providers_configured.includes('nvidia') ? '***' : '',
            openrouter: data.providers_configured.includes('openrouter') ? '***' : '',
          })
          if (data.model_prefs && Object.keys(data.model_prefs).length > 0) {
            setModelPrefs(data.model_prefs)
          }
          if (data.available_models) {
            setAvailableModels((prev) => ({
              ...prev,
              ...data.available_models,
            }))
          }
          if (data.limits) {
            setLimits(data.limits)
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
        if (res.data.models) {
          setAvailableModels((prev) => ({
            ...prev,
            [provider]: res.data.models,
          }))
        }
        
        // Refresh settings to get auto-saved config and updated limits
        const settingsRes = await getSettings()
        if (settingsRes.data) {
          setApiKeys({
            groq: settingsRes.data.providers_configured.includes('groq') ? '***' : '',
            nvidia: settingsRes.data.providers_configured.includes('nvidia') ? '***' : '',
            openrouter: settingsRes.data.providers_configured.includes('openrouter') ? '***' : '',
          })
          if (settingsRes.data.limits) {
            setLimits(settingsRes.data.limits)
          }
        }
        
        toast.success(`${provider.toUpperCase()} API key verified and saved!`)
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

  const handleDeleteKey = async (provider) => {
    try {
      const updatedKeys = { ...apiKeys, [provider]: '' }
      setApiKeys(updatedKeys)
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { status: 'idle', error: '' }
      }))
      
      const res = await saveSettings({
        api_keys: updatedKeys,
        model_prefs: modelPrefs,
      })
      if (res.data) {
        toast.success(`${provider.toUpperCase()} API key removed.`)
        store.setSettings(res.data)
        setApiKeys({
          groq: res.data.providers_configured.includes('groq') ? '***' : '',
          nvidia: res.data.providers_configured.includes('nvidia') ? '***' : '',
          openrouter: res.data.providers_configured.includes('openrouter') ? '***' : '',
        })
        setAvailableModels((prev) => ({
          ...prev,
          [provider]: []
        }))
        if (res.data.limits) {
          setLimits(res.data.limits)
        }
      }
    } catch (err) {
      console.error(err)
      toast.error(`Failed to remove ${provider} API key.`)
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
          groq: res.data.providers_configured.includes('groq') ? '***' : '',
          nvidia: res.data.providers_configured.includes('nvidia') ? '***' : '',
          openrouter: res.data.providers_configured.includes('openrouter') ? '***' : '',
        })
        if (res.data.available_models) {
          setAvailableModels((prev) => ({
            ...prev,
            ...res.data.available_models,
          }))
        }
        if (res.data.limits) {
          setLimits(res.data.limits)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const renderModelOptions = (taskKey, selectedVal) => {
    const hasModels = Object.values(availableModels).some((list) => list && list.length > 0)
    
    // We split selectedVal to check matching
    const [selectedProvider, selectedModel] = selectedVal && selectedVal.includes(':') 
      ? selectedVal.split(':') 
      : ['', selectedVal]

    // Check if the current selected model is verified/listed in availableModels
    const isSelectedVerified = Object.keys(availableModels).some((provider) => {
      const list = availableModels[provider]
      return list && list.includes(selectedModel) && (selectedProvider === '' || selectedProvider === provider)
    })

    const isModelRec = (provider, modelName) => {
      return RECOMMENDED_MODELS[taskKey].includes(`${provider}:${modelName}`)
    }

    return (
      <>
        {!isSelectedVerified && selectedVal && (
          <option value={selectedVal}>{selectedModel} (Configured)</option>
        )}
        {availableModels.groq && availableModels.groq.length > 0 && (
          <optgroup label="Groq">
            {availableModels.groq.map((m) => (
              <option key={`groq:${m}`} value={`groq:${m}`}>
                {m} {isModelRec('groq', m) ? '⭐ (Recommended)' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {availableModels.nvidia && availableModels.nvidia.length > 0 && (
          <optgroup label="Nvidia NIM">
            {availableModels.nvidia.map((m) => (
              <option key={`nvidia:${m}`} value={`nvidia:${m}`}>
                {m} {isModelRec('nvidia', m) ? '⭐ (Recommended)' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {availableModels.openrouter && availableModels.openrouter.length > 0 && (
          <optgroup label="OpenRouter">
            {availableModels.openrouter.map((m) => (
              <option key={`openrouter:${m}`} value={`openrouter:${m}`}>
                {m} {isModelRec('openrouter', m) ? '⭐ (Recommended)' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {!hasModels && !selectedVal && (
          <option value="">No verified models available. Please verify an API key first.</option>
        )}
      </>
    )
  }

  // OpenRouter Limit formatting
  const openRouterLimit = limits.openrouter
  const hasOpenRouterCredits = openRouterLimit && (openRouterLimit.limit_remaining !== null || openRouterLimit.usage !== undefined)

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

      {/* OpenRouter Credits Status Card */}
      {hasOpenRouterCredits && (
        <section className="glow-card rounded-2xl p-6 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 border border-indigo-850/60 space-y-4">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <h3 className="font-bold text-sm text-indigo-300 uppercase tracking-wider">OpenRouter API Credits Status</h3>
            </div>
            {openRouterLimit.is_free ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                Free Key
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                Paid Tier
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Remaining Limit</p>
              <p className="text-2xl font-black text-white mt-1">
                {openRouterLimit.limit_remaining !== null ? `$${parseFloat(openRouterLimit.limit_remaining).toFixed(4)}` : 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Key Usage</p>
              <p className="text-2xl font-black text-slate-350 mt-1">
                ${parseFloat(openRouterLimit.usage || 0).toFixed(4)}
              </p>
            </div>
            {openRouterLimit.limit !== null && openRouterLimit.limit > 0 && (
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs text-slate-500 uppercase font-semibold">Usage Allocation</p>
                <div className="mt-3.5 bg-slate-950 border border-slate-900 rounded-full h-2 overflow-hidden w-full">
                  <div 
                    className="bg-indigo-500 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (parseFloat(openRouterLimit.usage || 0) / parseFloat(openRouterLimit.limit)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => handleTestKey('groq')}
                  disabled={testStatus.groq.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center space-x-1"
                >
                  {testStatus.groq.status === 'testing' ? 'Verifying...' : 'Verify & Save'}
                </button>
                <div className="flex items-center space-x-2">
                  {apiKeys.groq && (
                    <button
                      type="button"
                      onClick={() => handleDeleteKey('groq')}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {testStatus.groq.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                  {testStatus.groq.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
                </div>
              </div>
              {testStatus.groq.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.groq.error}</p>
              )}
            </div>

            {/* Nvidia NIM */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4 relative flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Nvidia NIM</h3>
                <p className="text-xs text-slate-500 mt-1">High-performance open models.</p>
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-400 font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKeys.nvidia}
                    onChange={(e) => setApiKeys({ ...apiKeys, nvidia: e.target.value })}
                    placeholder={apiKeys.nvidia === '***' ? '••••••••••••' : 'Enter API Key'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => handleTestKey('nvidia')}
                  disabled={testStatus.nvidia.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center space-x-1"
                >
                  {testStatus.nvidia.status === 'testing' ? 'Verifying...' : 'Verify & Save'}
                </button>
                <div className="flex items-center space-x-2">
                  {apiKeys.nvidia && (
                    <button
                      type="button"
                      onClick={() => handleDeleteKey('nvidia')}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {testStatus.nvidia.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                  {testStatus.nvidia.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
                </div>
              </div>
              {testStatus.nvidia.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.nvidia.error}</p>
              )}
            </div>

            {/* OpenRouter */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4 relative flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">OpenRouter</h3>
                <p className="text-xs text-slate-500 mt-1">Universal route to Claude/GPT/DeepSeek.</p>
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-400 font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKeys.openrouter}
                    onChange={(e) => setApiKeys({ ...apiKeys, openrouter: e.target.value })}
                    placeholder={apiKeys.openrouter === '***' ? '••••••••••••' : 'Enter API Key'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/60 mt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => handleTestKey('openrouter')}
                  disabled={testStatus.openrouter.status === 'testing'}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center space-x-1"
                >
                  {testStatus.openrouter.status === 'testing' ? 'Verifying...' : 'Verify & Save'}
                </button>
                <div className="flex items-center space-x-2">
                  {apiKeys.openrouter && (
                    <button
                      type="button"
                      onClick={() => handleDeleteKey('openrouter')}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {testStatus.openrouter.status === 'success' && <Check className="h-5 w-5 text-emerald-400" />}
                  {testStatus.openrouter.status === 'error' && <X className="h-5 w-5 text-rose-500" />}
                </div>
              </div>
              {testStatus.openrouter.error && (
                <p className="text-[10px] text-rose-400 mt-1 break-words">{testStatus.openrouter.error}</p>
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
              >
                {renderModelOptions('extraction', modelPrefs.extraction)}
              </select>
            </div>

            {/* Tagging */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-semibold block">Tagging Model (Balanced)</label>
              <select
                value={modelPrefs.tagging}
                onChange={(e) => setModelPrefs({ ...modelPrefs, tagging: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
              >
                {renderModelOptions('tagging', modelPrefs.tagging)}
              </select>
            </div>

            {/* Reasoning */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-semibold block">Reasoning Model (Capable)</label>
              <select
                value={modelPrefs.reasoning}
                onChange={(e) => setModelPrefs({ ...modelPrefs, reasoning: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
              >
                {renderModelOptions('reasoning', modelPrefs.reasoning)}
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
