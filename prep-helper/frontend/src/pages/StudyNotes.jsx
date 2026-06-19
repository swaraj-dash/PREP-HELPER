import React, { useState, useEffect } from 'react'
import { BookOpen, Search, Eye, EyeOff, LayoutList, HelpCircle, FileText, Loader, RefreshCw } from 'lucide-react'
import api from '../api/client'
import NoteBlock from '../components/NoteBlock'

export default function StudyNotes() {
  const [tags, setTags] = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [notes, setNotes] = useState([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  
  // Layout views state
  const [focusMode, setFocusMode] = useState(false)

  // Fetch tags for sidebar on mount
  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true)
      try {
        const res = await api.get('/tags')
        if (res.data) {
          // Filter tags that have usage_count > 0
          setTags(res.data.filter((t) => t.usage_count > 0))
        }
      } catch (err) {
        console.error('Failed to load study tags:', err)
      } finally {
        setLoadingTags(false)
      }
    }
    fetchTags()
  }, [])

  // Fetch notes when topic selection changes
  useEffect(() => {
    if (!selectedTopic) return

    const fetchNotes = async () => {
      setLoadingNotes(true)
      try {
        const res = await api.get(`/notes/topic/${encodeURIComponent(selectedTopic.name)}`)
        if (res.data) {
          setNotes(res.data)
        }
      } catch (err) {
        console.error('Failed to load topic notes:', err)
      } finally {
        setLoadingNotes(false)
      }
    }
    fetchNotes()
  }, [selectedTopic])

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  )

  const handleNoteUpdate = (updatedNote) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative min-h-[85vh]">
      {/* Header controls */}
      {!focusMode && (
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Study Notes</h1>
          <p className="text-slate-400 mt-1">
            Read AI-extracted concept notes aggregated from all your documents in sequence.
          </p>
        </div>
      )}

      {/* Main split grid */}
      <div className={`grid grid-cols-1 gap-8 transition-all duration-500 ${focusMode ? 'max-w-3xl mx-auto grid-cols-1' : 'lg:grid-cols-4'}`}>
        
        {/* Left Side: Topics Sidebar List (hidden in Focus Mode) */}
        {!focusMode && (
          <aside className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6 h-fit max-h-[80vh] flex flex-col min-h-0">
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center space-x-2 text-white border-b border-slate-800/60 pb-3">
                <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
                <h2 className="font-bold text-sm uppercase tracking-wider">Concept Topics</h2>
              </div>

              {/* Tag Search filter */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter topics..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Topics scrollbox */}
              <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 min-h-0 pt-2 max-h-[50vh]">
                {loadingTags ? (
                  <div className="py-8 text-center text-xs text-slate-500">Loading topics list...</div>
                ) : filteredTags.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-600">No active topics found.</div>
                ) : (
                  filteredTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTopic(t)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                        selectedTopic?.id === t.id
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-950/40 border border-slate-850 hover:bg-slate-900/50 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate mr-2">{t.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold ${
                        selectedTopic?.id === t.id ? 'bg-indigo-750 text-white' : 'bg-slate-900 text-slate-500'
                      }`}>
                        {t.usage_count}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Right Side: Notes Sequenced list */}
        <main className={`${focusMode ? 'w-full' : 'lg:col-span-3'} space-y-6`}>
          {/* Header toolbar for topic actions */}
          {selectedTopic && (
            <div className="flex justify-between items-center bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selected Topic:</span>
                <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs font-extrabold tracking-wide uppercase select-none">
                  {selectedTopic.name}
                </span>
              </div>

              {/* Focus Mode button */}
              <button
                onClick={() => setFocusMode(!focusMode)}
                className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
                title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
              >
                {focusMode ? (
                  <>
                    <EyeOff className="h-4 w-4 text-rose-400" />
                    <span>Exit Focus Mode</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-indigo-400" />
                    <span>Focus Mode</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Notes display */}
          {!selectedTopic ? (
            /* Empty selection state */
            <div className="glow-card border border-slate-800 rounded-3xl p-24 text-center space-y-6">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <LayoutList className="h-8 w-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Select a study topic</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Choose a technical concept or domain tag from the left panel to review study notes merged sequentially across all your uploaded files.
                </p>
              </div>
            </div>
          ) : loadingNotes ? (
            /* Loading notes spinner */
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm">Assembling sequential study guide...</p>
            </div>
          ) : notes.length === 0 ? (
            /* No notes state */
            <div className="glow-card border border-slate-800 rounded-3xl p-20 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">No study notes linked to this topic</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                This tag has associated items, but none are Note chunks. Check the Question Bank to see related questions.
              </p>
            </div>
          ) : (
            /* Sequenced Note blocks feed */
            <div className="space-y-8 pb-12">
              {notes.map((note, index) => {
                const prevNote = index > 0 ? notes[index - 1] : null
                const isDifferentDoc = !prevNote || prevNote.document_id !== note.document_id

                return (
                  <React.Fragment key={note.id}>
                    {/* Visual section divider when changing source document */}
                    {isDifferentDoc && (
                      <div className="flex items-center space-x-4 pt-4 animate-fadeIn">
                        <div className="flex-1 border-t border-slate-800/80 border-dashed" />
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-full select-none">
                          <FileText className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{note.source_doc_name}</span>
                        </div>
                        <div className="flex-1 border-t border-slate-800/80 border-dashed" />
                      </div>
                    )}

                    <NoteBlock
                      note={note}
                      onUpdate={handleNoteUpdate}
                      showSource={!focusMode} // hide source pills in focus mode for clean layout
                    />
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
