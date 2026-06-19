import React, { useState, useEffect } from 'react'
import { 
  Search, 
  GitMerge, 
  Trash2, 
  Plus, 
  Edit2, 
  Save, 
  X, 
  AlertTriangle, 
  Check, 
  Tags, 
  RefreshCw,
  HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import TagChip from '../components/TagChip'
import { getTags, createTag, patchTag, mergeTags, deleteTag } from '../api/client'

const TAG_TYPES = ['tech', 'concept', 'domain', 'difficulty', 'custom']

export default function TagManager() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // New Tag form state
  const [newTagName, setNewTagName] = useState('')
  const [newTagType, setNewTagType] = useState('custom')
  const [isCreating, setIsCreating] = useState(false)

  // Inline edit state
  const [editingTagId, setEditingTagId] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')

  // Merge modal state
  const [mergeSource, setMergeSource] = useState(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeSearchText, setMergeSearchText] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch tags
  const fetchTags = async () => {
    setLoading(true)
    try {
      const res = await getTags()
      if (res.data) {
        setTags(res.data)
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  // Create Tag
  const handleCreateTag = async (e) => {
    e.preventDefault()
    const nameTrimmed = newTagName.trim()
    if (!nameTrimmed) {
      toast.error('Tag name cannot be empty.')
      return
    }

    setIsCreating(true)
    try {
      const res = await createTag({
        name: nameTrimmed,
        tag_type: newTagType
      })
      if (res.data) {
        toast.success(`Tag '${res.data.name}' created successfully!`)
        setNewTagName('')
        setNewTagType('custom')
        fetchTags()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsCreating(false)
    }
  }

  // Quick edit Tag Type
  const handleUpdateType = async (tag, newType) => {
    try {
      const res = await patchTag(tag.id, { tag_type: newType })
      if (res.data) {
        toast.success(`Updated tag type of '${tag.name}' to ${newType}`)
        setTags(tags.map(t => t.id === tag.id ? res.data : t))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Start inline name edit
  const startEditName = (tag) => {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
  }

  // Save inline name edit
  const handleSaveName = async (id) => {
    const nameTrimmed = editingTagName.trim()
    if (!nameTrimmed) {
      toast.error('Tag name cannot be empty.')
      return
    }

    try {
      const res = await patchTag(id, { name: nameTrimmed })
      if (res.data) {
        toast.success('Tag renamed successfully.')
        setTags(tags.map(t => t.id === id ? res.data : t))
        setEditingTagId(null)
        setEditingTagName('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Open Merge Modal
  const openMergeModal = (tag) => {
    setMergeSource(tag)
    setMergeTargetId('')
    setMergeSearchText('')
  }

  // Execute Merge Tags
  const handleExecuteMerge = async () => {
    if (!mergeSource || !mergeTargetId) return

    setIsMerging(true)
    try {
      const res = await mergeTags({
        source_tag_id: mergeSource.id,
        target_tag_id: mergeTargetId
      })
      if (res.data) {
        toast.success(`Successfully merged items into '${res.data.name}'!`)
        setMergeSource(null)
        setMergeTargetId('')
        fetchTags()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsMerging(false)
    }
  }

  // Handle Delete Click
  const handleDeleteClick = async (tag) => {
    if (tag.usage_count > 0) {
      // Prompt warning confirmation
      setDeleteTarget(tag)
    } else {
      // Delete immediately
      try {
        const res = await deleteTag(tag.id)
        if (res.data && res.data.success) {
          toast.success('Tag deleted successfully.')
          setTags(tags.filter(t => t.id !== tag.id))
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Execute Force Delete
  const handleExecuteForceDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const res = await deleteTag(deleteTarget.id, true)
      if (res.data && res.data.success) {
        toast.success(`Tag '${deleteTarget.name}' deleted and links removed.`)
        setTags(tags.filter(t => t.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Filters logic
  const filteredTags = tags.filter((tag) => {
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = activeTab === 'all' || tag.tag_type.toLowerCase() === activeTab.toLowerCase()
    return matchesSearch && matchesType
  })

  // Count tags per type
  const getTypeCount = (type) => {
    if (type === 'all') return tags.length
    return tags.filter(t => t.tag_type.toLowerCase() === type.toLowerCase()).length
  }

  // Merge modal autocomplete tags filter
  const mergeTargetOptions = tags.filter(t => 
    t.id !== (mergeSource?.id || '') && 
    t.name.toLowerCase().includes(mergeSearchText.toLowerCase())
  )

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2.5">
            <Tags className="h-8 w-8 text-indigo-400" />
            <span>Tag Manager</span>
          </h1>
          <p className="text-slate-400 mt-1">
            Standardize, edit, delete, and merge duplicate tags across questions and notes.
          </p>
        </div>

        {/* Quick Refresh */}
        <button
          onClick={fetchTags}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700/60 disabled:opacity-50 transition-colors flex items-center space-x-1.5"
          title="Reload tags from DB"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-wider">Reload</span>
        </button>
      </div>

      {/* Grid: Create Form & Filters Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Custom Tag Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-fit space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              <span>Create New Tag</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manually add a tag to the vocabulary.
            </p>
          </div>

          <form onSubmit={handleCreateTag} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tag Name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g. LangChain"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tag Category</label>
              <select
                value={newTagType}
                onChange={(e) => setNewTagType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition-colors"
              >
                {TAG_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreating || !newTagName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2"
            >
              {isCreating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Create Tag</span>
            </button>
          </form>
        </div>

        {/* Right side: Search & Table list */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
          
          {/* Controls Bar: Search & Filter Tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4.5 w-4.5 text-slate-500" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full bg-slate-900/40 border border-slate-800 focus:border-indigo-500 focus:outline-none pl-10.5 pr-4 py-2 text-sm text-slate-100 placeholder-slate-550 rounded-2xl transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-800/80 pb-1">
            {['all', ...TAG_TYPES].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === tab 
                    ? 'border-indigo-500 text-white font-extrabold' 
                    : 'border-transparent text-slate-450 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                <span>{tab}</span>
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-slate-900 border border-slate-800 text-slate-400 ${
                  activeTab === tab ? 'text-indigo-400 border-indigo-500/20' : ''
                }`}>
                  {getTypeCount(tab)}
                </span>
              </button>
            ))}
          </div>

          {/* Tags Table */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/40 border-b border-slate-850 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Tag Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-center">Items Linked</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400" />
                        <span className="block mt-2 font-bold text-xs uppercase tracking-wider">Loading tags...</span>
                      </td>
                    </tr>
                  ) : filteredTags.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                        No tags found matching query/type.
                      </td>
                    </tr>
                  ) : (
                    filteredTags.map((tag) => (
                      <tr key={tag.id} className="hover:bg-slate-900/10 transition-colors group">
                        
                        {/* Column 1: Name (Inline Editable) */}
                        <td className="px-6 py-4">
                          {editingTagId === tag.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveName(tag.id)
                                  if (e.key === 'Escape') setEditingTagId(null)
                                }}
                                className="bg-slate-950 border border-indigo-500 focus:outline-none rounded-lg px-2 py-1 text-xs text-slate-100"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveName(tag.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingTagId(null)}
                                className="p-1 text-slate-400 hover:text-slate-200"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <TagChip name={tag.name} type={tag.tag_type} />
                              <button
                                onClick={() => startEditName(tag)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-opacity"
                                title="Rename tag"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Column 2: Category Dropdown */}
                        <td className="px-6 py-4">
                          <select
                            value={tag.tag_type}
                            onChange={(e) => handleUpdateType(tag, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-350 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            {TAG_TYPES.map(type => (
                              <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Column 3: Count */}
                        <td className="px-6 py-4 text-center font-semibold text-slate-300">
                          {tag.usage_count}
                        </td>

                        {/* Column 4: Merge & Delete buttons */}
                        <td className="px-6 py-4 text-right space-x-1.5">
                          <button
                            onClick={() => openMergeModal(tag)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold border border-indigo-900/60 bg-indigo-950/30 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                            title="Merge this tag into another target tag"
                          >
                            <GitMerge className="h-3.5 w-3.5" />
                            <span>Merge</span>
                          </button>

                          <button
                            onClick={() => handleDeleteClick(tag)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold border border-rose-950/60 bg-rose-950/20 text-rose-450 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                            title="Delete this tag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Merge Tag Modal */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative p-6 space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <GitMerge className="h-5 w-5 text-indigo-400" />
                  <span>Merge Duplicate Tag</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Re-assign all questions/notes linked to this tag to another.
                </p>
              </div>
              <button
                onClick={() => setMergeSource(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="bg-indigo-950/30 border border-indigo-900/60 p-4 rounded-2xl text-xs leading-relaxed text-indigo-300">
              <p className="font-bold uppercase tracking-wider mb-1 text-[10px] text-indigo-400">Action Impact Details</p>
              Merging will re-map the <strong className="text-white">{mergeSource.usage_count} items</strong> currently using <strong className="text-white">'{mergeSource.name}'</strong> to point to your selected target tag. 
              After re-mapping, the duplicate tag <strong className="text-white">'{mergeSource.name}'</strong> will be permanently deleted.
            </div>

            {/* Inputs: Target tag autocomplete/select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Select Target Tag</label>
              
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  value={mergeSearchText}
                  onChange={(e) => setMergeSearchText(e.target.value)}
                  placeholder="Type target tag name to filter..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Scrollable List of Targets */}
              <div className="max-h-40 overflow-y-auto border border-slate-800/80 bg-slate-950/60 rounded-xl p-1 divide-y divide-slate-900">
                {mergeTargetOptions.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">No other tags match your text.</p>
                ) : (
                  mergeTargetOptions.map((tgt) => (
                    <button
                      key={tgt.id}
                      type="button"
                      onClick={() => setMergeTargetId(tgt.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between items-center transition-colors ${
                        mergeTargetId === tgt.id 
                          ? 'bg-indigo-600/20 text-white border border-indigo-650' 
                          : 'text-slate-350 hover:bg-slate-900 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <TagChip name={tgt.name} type={tgt.tag_type} size="small" />
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {tgt.usage_count} items
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={isMerging || !mergeTargetId}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-1.5"
              >
                {isMerging ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <GitMerge className="h-4 w-4" />
                )}
                <span>Complete Merge</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Delete Warn Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative p-6 space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="h-6 w-6 text-rose-450" />
                <h3 className="text-lg font-bold text-white">Safe Delete Restricted</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content text */}
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                The tag <strong className="text-white">'{deleteTarget.name}'</strong> is currently associated with <strong className="text-rose-400 font-bold">{deleteTarget.usage_count} item(s)</strong> in your vault.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed bg-rose-950/10 border border-rose-950/30 p-3.5 rounded-xl">
                ⚠️ <strong>Warning:</strong> Forcing this deletion will remove the tag association from all those items immediately. The tag itself will be deleted permanently. This cannot be undone.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-350 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteForceDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/10 flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Force Delete</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
