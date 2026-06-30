import React, { useState } from 'react'
import { Star, Edit2, Trash2, Check, X, FileText, ChevronDown, ChevronUp, Plus, Tag as TagIcon, Sparkles, RefreshCw } from 'lucide-react'
import { getTagClasses } from '../utils/tagColors'
import api, { suggestQuestionMetadata } from '../api/client'
import toast from 'react-hot-toast'
import MarkdownRenderer from './MarkdownRenderer'

export default function QuestionCard({ question, onUpdate, onDelete }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState('combined')

  // Determine which answer text to display
  const getActiveAnswer = () => {
    if (selectedSourceId === 'combined' && question.combined_answer) {
      return question.combined_answer
    }
    const matched = question.sources?.find(s => s.question_id === selectedSourceId)
    return matched ? matched.answer_text : question.answer_text
  }
  
  // Inline edit states
  const [questionText, setQuestionText] = useState(question.question_text)
  const [answerText, setAnswerText] = useState(question.answer_text)
  const [difficulty, setDifficulty] = useState(question.difficulty || 'intermediate')
  const [editTags, setEditTags] = useState(question.tags.map(t => t.name))
  const [newTagInput, setNewTagInput] = useState('')

  // State to track if deletion confirmation is active for this card
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleBookmarkToggle = async () => {
    try {
      const res = await api.patch(`/questions/${question.id}`, {
        bookmarked: !question.bookmarked
      })
      if (res.data) {
        onUpdate(res.data)
        toast.success(res.data.bookmarked ? 'Question bookmarked!' : 'Bookmark removed.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!questionText.trim() || !answerText.trim()) {
      toast.error('Question and Answer text cannot be empty.')
      return
    }

    const tagsOriginal = question.tags.map(t => t.name)
    const add_tags = editTags.filter(t => !tagsOriginal.includes(t))
    const remove_tags = tagsOriginal.filter(t => !editTags.includes(t))

    try {
      const res = await api.patch(`/questions/${question.id}`, {
        question_text: questionText,
        answer_text: answerText,
        difficulty,
        add_tags,
        remove_tags
      })
      if (res.data) {
        onUpdate(res.data)
        setIsEditing(false)
        toast.success('Question updated successfully!')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancel = () => {
    setQuestionText(question.question_text)
    setAnswerText(question.answer_text)
    setDifficulty(question.difficulty || 'intermediate')
    setEditTags(question.tags.map(t => t.name))
    setNewTagInput('')
    setIsEditing(false)
  }

  const [isSuggesting, setIsSuggesting] = useState(false)

  const handleAISuggest = async () => {
    if (!questionText.trim() || !answerText.trim()) {
      toast.error('Question and Answer text are required to suggest metadata.')
      return
    }

    setIsSuggesting(true)
    try {
      const res = await suggestQuestionMetadata({
        question_text: questionText,
        answer_text: answerText
      })
      if (res.data) {
        const { difficulty: suggestedDifficulty, tags: suggestedTags } = res.data
        setDifficulty(suggestedDifficulty)
        
        // Merge suggested tags, avoiding duplicates
        const uniqueMerged = [...new Set([...editTags, ...suggestedTags])]
        setEditTags(uniqueMerged)
        
        toast.success('AI suggestions applied! Click Save to keep changes.')
      }
    } catch (err) {
      console.error('AI suggestion failed:', err)
    } finally {
      setIsSuggesting(false)
    }
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

  const handleDeleteClick = async () => {
    try {
      const res = await api.delete(`/questions/${question.id}`)
      if (res.data && res.data.success) {
        onDelete(question.id)
        toast.success('Question deleted successfully.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 transition-all duration-300 hover:border-slate-700/60 shadow-lg relative overflow-hidden flex flex-col justify-between">
      {/* Ambient background glow */}
      {question.bookmarked && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      )}

      {isEditing ? (
        /* Edit Form mode */
        <form onSubmit={handleSave} className="space-y-4 text-left w-full">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Question Text</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Answer Text</label>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors"
            />
          </div>

          {/* Difficulty & Tag Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Difficulty</label>
                <button
                  type="button"
                  onClick={handleAISuggest}
                  disabled={isSuggesting}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1 disabled:opacity-50"
                  title="Estimate difficulty and suggest tags using AI based on card content"
                >
                  {isSuggesting ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Suggesting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      <span>Suggest with AI</span>
                    </>
                  )}
                </button>
              </div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Add Tag (Supports Custom)</label>
              <div className="flex space-x-2">
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
                  className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 p-2.5 rounded-xl transition-colors"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>
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
                  <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-rose-400">
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
              onClick={handleCancel}
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
        /* Read card mode */
        <div className="space-y-4 text-left w-full flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header: Difficulty & Attributions */}
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md border ${
                question.difficulty === 'beginner' ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' :
                question.difficulty === 'advanced' ? 'bg-rose-950/40 border-rose-900/60 text-rose-400' :
                'bg-amber-950/40 border-amber-900/60 text-amber-400'
              }`}>
                {question.difficulty || 'intermediate'}
              </span>
              
              <div className="flex items-center space-x-1">
                {/* Bookmark */}
                <button
                  onClick={handleBookmarkToggle}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    question.bookmarked 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                      : 'border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-800/40'
                  }`}
                  title={question.bookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                >
                  <Star className={`h-4 w-4 ${question.bookmarked ? 'fill-current' : ''}`} />
                </button>

                {/* Edit */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-slate-800/40 transition-colors"
                  title="Edit Question"
                >
                  <Edit2 className="h-4 w-4" />
                </button>

                {/* Delete */}
                {confirmDelete ? (
                  <div className="flex items-center space-x-1 bg-rose-500/10 border border-rose-500/20 rounded-lg p-0.5 animate-fadeIn">
                    <button
                      onClick={handleDeleteClick}
                      className="text-rose-400 hover:text-rose-350 px-2 py-1 text-[10px] font-bold uppercase"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-slate-800/40 transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Question Text */}
            <p className="text-sm font-bold text-slate-100 leading-relaxed pt-1">
              {question.question_text}
            </p>
          </div>

          {/* Collapsible Answer */}
          <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3">
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="flex items-center space-x-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
            >
              <span>{showAnswer ? 'Hide Answer' : 'Show Answer'}</span>
              {showAnswer ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAnswer && (
              <div className="space-y-3">
                {question.sources && question.sources.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 pb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center mr-1">Sources:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceId('combined')}
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition-all border ${
                        selectedSourceId === 'combined'
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-400'
                          : 'bg-slate-950/40 border-slate-850 text-slate-450 hover:text-slate-350 hover:border-slate-800'
                      }`}
                    >
                      Combined
                    </button>
                    {question.sources.map((src) => (
                      <button
                        key={src.question_id}
                        type="button"
                        onClick={() => setSelectedSourceId(src.question_id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all border truncate max-w-[150px] ${
                          selectedSourceId === src.question_id
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-400'
                            : 'bg-slate-950/40 border-slate-850 text-slate-450 hover:text-slate-350 hover:border-slate-800'
                        }`}
                        title={`${src.document_name} (p. ${src.source_page || '?'})`}
                      >
                        {src.document_name.replace(/\.pdf$/i, '')}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="bg-slate-950/60 border border-slate-850/80 p-4 rounded-2xl select-text animate-slideDown">
                  <MarkdownRenderer text={getActiveAnswer()} />
                </div>
              </div>
            )}
          </div>

          {/* Footer: Tags & Footnotes */}
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-col space-y-3">
            {/* Tag pills */}
            {question.tags && question.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {question.tags.map((tag) => {
                  const classes = getTagClasses(tag.tag_type)
                  return (
                    <span key={tag.id} className={classes}>
                      {tag.name}
                    </span>
                  )
                })}
              </div>
            )}

            {/* File Footnote */}
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span className="truncate max-w-[250px]" title="Attribution">
                {selectedSourceId === 'combined'
                  ? `${question.sources && question.sources.length > 1 ? `${question.sources.length} PDFs Merged` : 'From database metadata'}`
                  : (() => {
                      const matched = question.sources?.find(s => s.question_id === selectedSourceId)
                      return matched ? `${matched.document_name} (Page ${matched.source_page || '?'})` : 'From database metadata'
                    })()
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
