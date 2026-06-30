import React, { useState, useEffect } from 'react'
import { FileText, Plus, Edit2, Trash2, Check, X, MessageSquare } from 'lucide-react'
import { getTagClasses } from '../utils/tagColors'
import { getAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, patchNote } from '../api/client'
import toast from 'react-hot-toast'
import MarkdownRenderer from './MarkdownRenderer'

export default function NoteBlock({ note, onUpdate, showSource = true }) {
  const [isEditing, setIsEditing] = useState(false)
  const [noteHeading, setNoteHeading] = useState(note.heading || '')
  const [noteContent, setNoteContent] = useState(note.content)
  const [editTags, setEditTags] = useState(note.tags.map(t => t.name))
  const [newTagInput, setNewTagInput] = useState('')

  // Annotations state
  const [annotations, setAnnotations] = useState([])
  const [loadingAnnotations, setLoadingAnnotations] = useState(false)
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false)
  const [newAnnotationText, setNewAnnotationText] = useState('')
  const [editingAnnotationId, setEditingAnnotationId] = useState(null)
  const [editingAnnotationText, setEditingAnnotationText] = useState('')

  // Load annotations linked to this note chunk on mount
  useEffect(() => {
    const fetchAnnotations = async () => {
      setLoadingAnnotations(true)
      try {
        const res = await getAnnotations('note', note.id)
        if (res.data) {
          setAnnotations(res.data)
        }
      } catch (err) {
        console.error('Failed to load annotations:', err)
      } finally {
        setLoadingAnnotations(false)
      }
    }
    fetchAnnotations()
  }, [note.id])

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (!noteContent.trim()) {
      toast.error('Note content cannot be empty.')
      return
    }

    const tagsOriginal = note.tags.map(t => t.name)
    const add_tags = editTags.filter(t => !tagsOriginal.includes(t))
    const remove_tags = tagsOriginal.filter(t => !editTags.includes(t))

    try {
      const res = await patchNote(note.id, {
        heading: noteHeading,
        content: noteContent,
        add_tags,
        remove_tags
      })
      if (res.data) {
        if (onUpdate) onUpdate(res.data)
        setIsEditing(false)
        toast.success('Note updated successfully!')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancelEdit = () => {
    setNoteHeading(note.heading || '')
    setNoteContent(note.content)
    setEditTags(note.tags.map(t => t.name))
    setNewTagInput('')
    setIsEditing(false)
  }

  const handleAddTag = () => {
    const trimmed = newTagInput.trim()
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed])
      setNewTagInput('')
    }
  }

  const handleRemoveTag = (tagName) => {
    setEditTags(editTags.filter(t => t !== tagName))
  }

  // Annotation CRUD handlers
  const handleAddAnnotationSubmit = async (e) => {
    e.preventDefault()
    if (!newAnnotationText.trim()) return

    try {
      const res = await createAnnotation({
        item_type: 'note',
        item_id: note.id,
        annotation_text: newAnnotationText
      })
      if (res.data) {
        setAnnotations([res.data, ...annotations])
        setNewAnnotationText('')
        setIsAddingAnnotation(false)
        toast.success('Comment added!')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleStartEditAnnotation = (ann) => {
    setEditingAnnotationId(ann.id)
    setEditingAnnotationText(ann.annotation_text)
  }

  const handleSaveAnnotationEdit = async (id) => {
    if (!editingAnnotationText.trim()) return
    try {
      const res = await updateAnnotation(id, {
        annotation_text: editingAnnotationText
      })
      if (res.data) {
        setAnnotations(annotations.map(a => a.id === id ? res.data : a))
        setEditingAnnotationId(null)
        setEditingAnnotationText('')
        toast.success('Comment updated.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAnnotation = async (id) => {
    try {
      const res = await deleteAnnotation(id)
      if (res.data && res.data.success) {
        setAnnotations(annotations.filter(a => a.id !== id))
        toast.success('Comment deleted.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 transition-all duration-300 hover:border-slate-700/60 shadow-lg text-left flex flex-col justify-between space-y-4">
      {isEditing ? (
        /* Inline Note Editing mode */
        <form onSubmit={handleSaveNote} className="space-y-4 w-full">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Section Heading</label>
            <input
              type="text"
              value={noteHeading}
              onChange={(e) => setNoteHeading(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors"
              placeholder="e.g. Setting Up Zustand Store"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Content</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors"
            />
          </div>

          {/* Tags Inline Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Edit Tags (Supports Custom)</label>
            <div className="flex space-x-2 max-w-md">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="Type tag name..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-slate-950 border border-slate-855 hover:bg-slate-900 text-slate-300 p-2.5 rounded-xl transition-colors"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Tag Editor Chips */}
          {editTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {editTags.map((t) => (
                <span
                  key={t}
                  className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded flex items-center space-x-1"
                >
                  <span>{t}</span>
                  <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-rose-450">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-1"
            >
              <Check className="h-4 w-4" />
              <span>Save</span>
            </button>
          </div>
        </form>
      ) : (
        /* Read Mode */
        <div className="w-full space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1">
              {note.heading && (
                <h3 className="text-base font-bold text-white tracking-tight">
                  {note.heading}
                </h3>
              )}
            </div>
            
            {/* Edit button */}
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-slate-800/40 transition-colors flex-shrink-0 ml-2"
              title="Edit Note"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Note content */}
          <div className="text-slate-300 text-sm leading-relaxed select-text">
            <MarkdownRenderer text={note.content} />
          </div>

          {/* Tags & Source Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {note.tags && note.tags.map((tag) => (
                <span key={tag.id} className={getTagClasses(tag.tag_type)}>
                  {tag.name}
                </span>
              ))}
            </div>

            {showSource && (
              <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-slate-650" />
                <span className="truncate max-w-[250px]" title={note.source_doc_name}>
                  {note.source_doc_name}
                </span>
              </div>
            )}
          </div>

          {/* Annotations Section */}
          <div className="pt-4 border-t border-slate-800/60 space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-450 font-bold uppercase tracking-wider">
              <span className="flex items-center space-x-1.5 text-slate-450">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span>Comments & Highlights ({annotations.length})</span>
              </span>
              {!isAddingAnnotation && (
                <button
                  onClick={() => setIsAddingAnnotation(true)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors text-[10px] font-extrabold flex items-center space-x-0.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Comment</span>
                </button>
              )}
            </div>

            {/* Form to add annotation */}
            {isAddingAnnotation && (
              <form onSubmit={handleAddAnnotationSubmit} className="space-y-2 animate-fadeIn">
                <textarea
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  placeholder="Type personal note or highlight comment..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none transition-colors"
                />
                <div className="flex justify-end space-x-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAnnotation(false)
                      setNewAnnotationText('')
                    }}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-450 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all shadow-md shadow-indigo-600/10"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            {/* List of user annotations */}
            {annotations.length > 0 && (
              <div className="space-y-2 pt-1">
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="bg-indigo-950/20 border border-indigo-950/40 rounded-xl p-3 text-xs text-slate-300 relative group flex items-start justify-between space-x-2"
                  >
                    {editingAnnotationId === ann.id ? (
                      /* Editing comment */
                      <div className="w-full space-y-1.5">
                        <textarea
                          value={editingAnnotationText}
                          onChange={(e) => setEditingAnnotationText(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-colors"
                        />
                        <div className="flex justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingAnnotationId(null)}
                            className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-450 p-1 rounded-md transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveAnnotationEdit(ann.id)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded-md transition-colors"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display comment */
                      <>
                        <div className="flex-1 space-y-1">
                          <p className="leading-relaxed select-text">{ann.annotation_text}</p>
                          <span className="text-[9px] text-indigo-500/80 font-bold block">
                            {new Date(ann.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEditAnnotation(ann)}
                            className="text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-colors"
                            title="Edit Comment"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="text-slate-500 hover:text-rose-450 p-0.5 rounded transition-colors"
                            title="Delete Comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
