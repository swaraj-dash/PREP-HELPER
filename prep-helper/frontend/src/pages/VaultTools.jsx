import React, { useState, useEffect } from 'react'
import { 
  DownloadCloud, 
  UploadCloud, 
  Key, 
  FileCheck, 
  AlertTriangle, 
  Info, 
  Check, 
  Tag as TagIcon,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  FolderOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getTags, exportVault, previewVault, importVault } from '../api/client'

export default function VaultTools() {
  const [tags, setTags] = useState([])
  const [loadingTags, setLoadingTags] = useState(false)

  // Export State
  const [exportAll, setExportAll] = useState(true)
  const [selectedTags, setSelectedTags] = useState([])
  const [exportPassphrase, setExportPassphrase] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null) // { file_path, file_name, item_counts }

  // Import State
  const [importFilePath, setImportFilePath] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [importPreview, setImportPreview] = useState(null) // meta.json contents
  const [importPassphrase, setImportPassphrase] = useState('')
  const [collisionStrategy, setCollisionStrategy] = useState('keep_mine') // keep_mine | keep_theirs | keep_both
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null) // { imported, skipped, collisions }

  useEffect(() => {
    setLoadingTags(true)
    getTags()
      .then((res) => {
        if (res.data) {
          setTags(res.data)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch tags:', err)
      })
      .finally(() => {
        setLoadingTags(false)
      })
  }, [])

  const handleTagToggle = (tagId) => {
    setSelectedTags((prev) => 
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  // Passphrase strength calculation
  const getPassphraseStrength = (pass) => {
    if (!pass) return { score: 0, text: 'Empty', color: 'bg-slate-800' }
    let score = 0
    if (pass.length >= 6) score += 1
    if (pass.length >= 10) score += 1
    if (/\d/.test(pass)) score += 1
    if (/[a-zA-Z]/.test(pass) && /[^a-zA-Z0-9]/.test(pass)) score += 1

    if (score <= 1) return { score, text: 'Weak', color: 'bg-rose-500' }
    if (score <= 3) return { score, text: 'Medium', color: 'bg-amber-500' }
    return { score, text: 'Strong', color: 'bg-emerald-500' }
  }

  const exportStrength = getPassphraseStrength(exportPassphrase)

  const handleExport = async (e) => {
    e.preventDefault()
    if (!exportPassphrase || exportPassphrase.length < 4) {
      toast.error('Passphrase must be at least 4 characters long.')
      return
    }

    setExporting(true)
    setExportResult(null)
    try {
      const payload = {
        passphrase: exportPassphrase,
        tag_ids: exportAll ? null : selectedTags
      }
      const res = await exportVault(payload)
      if (res.data) {
        setExportResult(res.data)
        toast.success('Vault exported successfully!')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const handlePreview = async () => {
    if (!importFilePath.trim()) {
      toast.error('Please enter the path to a .phvault archive.')
      return
    }

    setPreviewing(true)
    setImportPreview(null)
    try {
      const res = await previewVault(importFilePath)
      if (res.data) {
        setImportPreview(res.data)
        toast.success('Archive parsed successfully. See preview below.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async (e) => {
    e.preventDefault()
    if (!importFilePath.trim()) {
      toast.error('Please enter the path to a .phvault archive.')
      return
    }
    if (!importPassphrase) {
      toast.error('Please enter the passphrase to decrypt the archive.')
      return
    }

    setImporting(true)
    setImportResult(null)
    try {
      const payload = {
        file_path: importFilePath,
        passphrase: importPassphrase,
        collision_strategy: collisionStrategy
      }
      const res = await importVault(payload)
      if (res.data) {
        setImportResult(res.data)
        toast.success(`Import complete! ${res.data.imported} items imported successfully.`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn text-slate-100">
      
      {/* Header Banner */}
      <div className="flex flex-col border-b border-slate-900 pb-6 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2.5">
          <span>Vault Portability & Tools</span>
        </h1>
        <p className="text-slate-400 mt-1">
          Export selected topic questions and notes into encrypted archives, or restore them using customizable conflict resolution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Panel 1: Export Vault */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6 text-left relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <DownloadCloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Export Encrypted Backup</h3>
                <p className="text-[11px] text-slate-450">Compress and encrypt your study bank.</p>
              </div>
            </div>

            <form onSubmit={handleExport} className="space-y-5">
              
              {/* Range selection */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Export Scope</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setExportAll(true)}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                      exportAll 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10' 
                        : 'bg-slate-950/60 border-slate-850 text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    Export All Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportAll(false)}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                      !exportAll 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10' 
                        : 'bg-slate-950/60 border-slate-850 text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    Filter by Topics
                  </button>
                </div>
              </div>

              {/* Tag Checklist */}
              {!exportAll && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                    Select Topics ({selectedTags.length} selected)
                  </label>
                  <div className="border border-slate-850 bg-slate-950/40 rounded-2xl p-3 max-h-40 overflow-y-auto scrollbar-thin flex flex-wrap gap-2">
                    {loadingTags ? (
                      <span className="text-[11px] text-slate-500 py-3 mx-auto">Loading topic tags...</span>
                    ) : tags.length === 0 ? (
                      <span className="text-[11px] text-slate-500 py-3 mx-auto">No tags available in vault.</span>
                    ) : (
                      tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag.id)
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleTagToggle(tag.id)}
                            className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center space-x-1.5 ${
                              isSelected 
                                ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300' 
                                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                            <TagIcon className="h-3 w-3" />
                            <span>{tag.name}</span>
                            {isSelected && <Check className="h-3 w-3 text-indigo-400" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Passphrase Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Passphrase</label>
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${exportStrength.color} text-slate-950 transition-all`}>
                    {exportStrength.text}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter strength-tested passphrase..."
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 pl-11 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    required
                  />
                  <Key className="h-4.5 w-4.5 text-slate-600 absolute left-4 top-3.5" />
                </div>
              </div>

              {/* Security Warning */}
              <div className="bg-amber-950/10 border border-amber-950/20 rounded-2xl p-4 flex items-start space-x-3 text-xs leading-relaxed text-amber-300">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Vault Security Warning</p>
                  <p className="text-[10px] text-amber-400/80">
                    Your passphrase will be used to derive an AES-256-GCM decryption key. Do not lose this passphrase — there is no recovery option, and your archive cannot be decrypted without it.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={exporting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Packing Archive...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="h-4.5 w-4.5" />
                    <span>Generate Secure Export (.phvault)</span>
                  </>
                )}
              </button>

            </form>

          </div>

          {/* Export Result Summary */}
          {exportResult && (
            <div className="mt-6 border-t border-slate-900 pt-5 space-y-3 animate-fadeIn">
              <div className="bg-emerald-950/10 border border-emerald-950/30 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Vault Archive Packaged!</span>
                </div>
                <div className="space-y-1 text-slate-400 text-[10px]">
                  <p className="font-mono text-slate-300 break-all select-all p-2 bg-slate-950 rounded-lg">
                    {exportResult.file_path}
                  </p>
                  <div className="flex justify-between items-center pt-1 font-semibold">
                    <span>Questions: {exportResult.item_counts.questions}</span>
                    <span>Notes: {exportResult.item_counts.notes}</span>
                    <span>Tags: {exportResult.item_counts.tags}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Panel 2: Import Vault */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6 text-left relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Decrypt & Import Vault</h3>
                <p className="text-[11px] text-slate-450">Restore or sync study items from an archive.</p>
              </div>
            </div>

            <div className="space-y-5">
              
              {/* File Path input */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Vault File Location</label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g. C:\vaults\20260620-export.phvault"
                      value={importFilePath}
                      onChange={(e) => setImportFilePath(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 pl-11 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                    <FolderOpen className="h-4.5 w-4.5 text-slate-600 absolute left-4 top-3.5" />
                  </div>
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing}
                    className="bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-350 hover:text-white px-4 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    {previewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {/* Preview Box */}
              {importPreview && (
                <div className="bg-slate-950/50 border border-slate-850/80 rounded-2xl p-4 space-y-3 animate-fadeIn text-xs">
                  <div className="flex justify-between items-center text-slate-400 font-bold border-b border-slate-900 pb-2 text-[10px] uppercase tracking-wider">
                    <span>Archive Preview</span>
                    <span>v{importPreview.version}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center py-1">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 block">Questions</span>
                      <span className="font-bold text-white text-sm">{importPreview.item_counts.questions}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 block">Notes</span>
                      <span className="font-bold text-white text-sm">{importPreview.item_counts.notes}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 block">Topics</span>
                      <span className="font-bold text-white text-sm">{importPreview.item_counts.tags}</span>
                    </div>
                  </div>
                  {importPreview.tag_names.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Included Topics:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1 scrollbar-thin">
                        {importPreview.tag_names.map((name) => (
                          <span key={name} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-850 text-[9px] font-bold text-slate-400">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Decryption & Strategy */}
              {importPreview && (
                <form onSubmit={handleImport} className="space-y-5 animate-fadeIn">
                  
                  {/* Passphrase */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Decryption Passphrase</label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Enter decryption passphrase..."
                        value={importPassphrase}
                        onChange={(e) => setImportPassphrase(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 pl-11 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                        required
                      />
                      <Key className="h-4.5 w-4.5 text-slate-600 absolute left-4 top-3.5" />
                    </div>
                  </div>

                  {/* Collision strategy */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Collision Conflict Strategy</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCollisionStrategy('keep_mine')}
                        className={`py-2.5 px-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 ${
                          collisionStrategy === 'keep_mine'
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/5'
                            : 'bg-slate-950 border-slate-850 text-slate-450 hover:text-slate-350'
                        }`}
                      >
                        <span className="font-extrabold">Keep Mine</span>
                        <span className="text-[8px] text-slate-500 font-medium">Skip incoming</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollisionStrategy('keep_theirs')}
                        className={`py-2.5 px-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 ${
                          collisionStrategy === 'keep_theirs'
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/5'
                            : 'bg-slate-950 border-slate-850 text-slate-450 hover:text-slate-350'
                        }`}
                      >
                        <span className="font-extrabold">Keep Theirs</span>
                        <span className="text-[8px] text-slate-500 font-medium">Overwrite local</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollisionStrategy('keep_both')}
                        className={`py-2.5 px-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 ${
                          collisionStrategy === 'keep_both'
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/5'
                            : 'bg-slate-950 border-slate-850 text-slate-450 hover:text-slate-350'
                        }`}
                      >
                        <span className="font-extrabold">Keep Both</span>
                        <span className="text-[8px] text-slate-500 font-medium">Import duplicate</span>
                      </button>
                    </div>
                  </div>

                  {/* Run Import */}
                  <button
                    type="submit"
                    disabled={importing}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center space-x-2"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Decrypting & Merging...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4.5 w-4.5" />
                        <span>Run Secure Import Session</span>
                      </>
                    )}
                  </button>

                </form>
              )}

            </div>

          </div>

          {/* Import Result Summary */}
          {importResult && (
            <div className="mt-6 border-t border-slate-900 pt-5 space-y-3 animate-fadeIn">
              <div className="bg-emerald-950/15 border border-emerald-950/30 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Import Completed Successfully!</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 pt-0.5 border-t border-slate-900/60 font-semibold">
                  <div>Imported Items: <span className="text-white font-bold">{importResult.imported}</span></div>
                  <div>Skipped Collisions: <span className="text-white font-bold">{importResult.skipped}</span></div>
                </div>
                {importResult.collisions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Conflict List ({importResult.collisions.length}):</span>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-900 max-h-24 overflow-y-auto scrollbar-thin space-y-1.5 text-[9px]">
                      {importResult.collisions.map((c, idx) => (
                        <div key={idx} className="border-b border-slate-900/40 pb-1.5 last:border-b-0">
                          <span className="font-bold text-slate-300 block truncate">{c.question_text}</span>
                          <span className="text-slate-500 block">Incoming: {c.incoming_answer.substring(0, 30)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
