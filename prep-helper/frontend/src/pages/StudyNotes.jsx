import React, { useState, useEffect } from 'react'
import { BookOpen, Search, Eye, EyeOff, LayoutList, HelpCircle, FileText, Loader, ChevronRight, ChevronDown, ChevronLeft, ArrowLeft, ArrowRight } from 'lucide-react'
import api from '../api/client'
import NoteBlock from '../components/NoteBlock'
import { NoteBlockSkeleton } from '../components/ui/Skeleton'

export default function StudyNotes() {
  // Grouped tags state (domain/tech chapters)
  const [tagGroups, setTagGroups] = useState([])
  const [expandedGroups, setExpandedGroups] = useState({})
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [notes, setNotes] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  
  // Layout state
  const [focusMode, setFocusMode] = useState(false)
  
  // All topics flat list for prev/next navigation
  const [allTopics, setAllTopics] = useState([])

  // Fetch grouped tags on mount
  useEffect(() => {
    const fetchGroupedTags = async () => {
      setLoadingGroups(true)
      try {
        const res = await api.get('/tags/grouped')
        if (res.data && res.data.groups) {
          setTagGroups(res.data.groups)
          
          // Build flat list for navigation and auto-expand all groups
          const flat = []
          const expanded = {}
          res.data.groups.forEach((group) => {
            expanded[group.type] = true
            group.tags.forEach((tag) => {
              flat.push(tag)
            })
          })
          setAllTopics(flat)
          setExpandedGroups(expanded)
        }
      } catch (err) {
        console.error('Failed to load grouped tags:', err)
        // Fallback to flat tag list
        try {
          const fallback = await api.get('/tags')
          if (fallback.data) {
            const activeTags = fallback.data.filter((t) => t.usage_count > 0)
            setTagGroups([{ type: 'all', label: 'All Topics', tags: activeTags }])
            setAllTopics(activeTags)
            setExpandedGroups({ all: true })
          }
        } catch (e) {
          console.error('Fallback tag fetch failed:', e)
        }
      } finally {
        setLoadingGroups(false)
      }
    }
    fetchGroupedTags()
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

  // Filter groups/tags by search
  const filteredGroups = tagGroups.map((group) => ({
    ...group,
    tags: group.tags.filter((t) =>
      t.name.toLowerCase().includes(tagSearch.toLowerCase())
    ),
  })).filter((g) => g.tags.length > 0)

  const toggleGroup = (type) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  // Previous / Next topic navigation
  const currentTopicIndex = selectedTopic
    ? allTopics.findIndex((t) => t.id === selectedTopic.id)
    : -1

  const goToPrevTopic = () => {
    if (currentTopicIndex > 0) {
      setSelectedTopic(allTopics[currentTopicIndex - 1])
    }
  }

  const goToNextTopic = () => {
    if (currentTopicIndex < allTopics.length - 1) {
      setSelectedTopic(allTopics[currentTopicIndex + 1])
    }
  }

  const handleNoteUpdate = (updatedNote) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    )
  }

  // Group icon colors
  const groupColors = {
    tech: 'text-cyan-400',
    domain: 'text-purple-400',
    concept: 'text-amber-400',
    custom: 'text-emerald-400',
    difficulty: 'text-rose-400',
    content_type: 'text-slate-400',
  }

  const groupBgColors = {
    tech: 'bg-cyan-950/30 border-cyan-500/10',
    domain: 'bg-purple-950/30 border-purple-500/10',
    concept: 'bg-amber-950/30 border-amber-500/10',
    custom: 'bg-emerald-950/30 border-emerald-500/10',
    difficulty: 'bg-rose-950/30 border-rose-500/10',
    content_type: 'bg-slate-900/30 border-slate-800',
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative min-h-[85vh]">
      {/* Header controls */}
      {!focusMode && (
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Study Notes</h1>
          <p className="text-slate-400 mt-1">
            Browse study notes organized by technology, domain, and concept — like chapters in a textbook.
          </p>
        </div>
      )}

      {/* Main split grid */}
      <div className={`grid grid-cols-1 gap-8 transition-all duration-500 ${focusMode ? 'max-w-3xl mx-auto grid-cols-1' : 'lg:grid-cols-4'}`}>
        
        {/* Left Side: W3Schools-style Chapter Navigation */}
        {!focusMode && (
          <aside className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4 h-fit max-h-[80vh] flex flex-col min-h-0">
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-center space-x-2 text-white border-b border-slate-800/60 pb-3">
                <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
                <h2 className="font-bold text-sm uppercase tracking-wider">Chapters</h2>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Search topics..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Chapter Groups Scrollbox */}
              <div className="overflow-y-auto flex-1 pr-1 space-y-3 min-h-0 pt-1 max-h-[55vh]">
                {loadingGroups ? (
                  <div className="py-8 text-center text-xs text-slate-500">Loading chapters...</div>
                ) : filteredGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-600">
                    {tagSearch ? 'No matching topics found.' : 'No topics yet. Upload documents to get started.'}
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.type} className="space-y-1">
                      {/* Group Header — Clickable Accordion */}
                      <button
                        onClick={() => toggleGroup(group.type)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-between border ${
                          groupBgColors[group.type] || 'bg-slate-900/40 border-slate-800'
                        } hover:brightness-110`}
                      >
                        <span className={`flex items-center space-x-2 ${groupColors[group.type] || 'text-slate-300'}`}>
                          <span>{group.label}</span>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-950/60 px-1.5 py-0.5 rounded normal-case">
                            {group.tags.length}
                          </span>
                        </span>
                        {expandedGroups[group.type] ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </button>

                      {/* Group Topics (Chapters) */}
                      {expandedGroups[group.type] && (
                        <div className="pl-2 space-y-0.5 animate-fadeIn">
                          {group.tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => setSelectedTopic(tag)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between group ${
                                selectedTopic?.id === tag.id
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                              }`}
                            >
                              <span className="flex items-center space-x-2 truncate mr-2">
                                <ChevronRight className={`h-3 w-3 flex-shrink-0 transition-transform ${
                                  selectedTopic?.id === tag.id ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'
                                }`} />
                                <span className="truncate">{tag.name}</span>
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                                selectedTopic?.id === tag.id ? 'bg-indigo-500/60 text-white' : 'bg-slate-950/60 text-slate-600'
                              }`}>
                                {tag.usage_count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Right Side: Notes Content Area */}
        <main className={`${focusMode ? 'w-full' : 'lg:col-span-3'} space-y-6`}>
          {/* Header toolbar for topic actions */}
          {selectedTopic && (
            <div className="flex justify-between items-center bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Prev/Next navigation */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={goToPrevTopic}
                    disabled={currentTopicIndex <= 0}
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous Topic"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={goToNextTopic}
                    disabled={currentTopicIndex >= allTopics.length - 1}
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next Topic"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-shrink-0">Topic:</span>
                  <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs font-extrabold tracking-wide uppercase select-none truncate">
                    {selectedTopic.name}
                  </span>
                  {currentTopicIndex >= 0 && (
                    <span className="text-[10px] text-slate-600 font-bold flex-shrink-0">
                      {currentTopicIndex + 1}/{allTopics.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Focus Mode button */}
              <button
                onClick={() => setFocusMode(!focusMode)}
                className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 flex-shrink-0"
                title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
              >
                {focusMode ? (
                  <>
                    <EyeOff className="h-4 w-4 text-rose-400" />
                    <span>Exit Focus</span>
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
                <h3 className="text-lg font-bold text-white">Select a chapter to study</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Choose a technology, domain, or concept from the left panel to browse study notes — organized like chapters in a textbook.
                </p>
              </div>
            </div>
          ) : loadingNotes ? (
            <div className="space-y-6">
              <NoteBlockSkeleton />
              <NoteBlockSkeleton />
              <NoteBlockSkeleton />
            </div>
          ) : notes.length === 0 ? (
            /* No notes state */
            <div className="glow-card border border-slate-800 rounded-3xl p-20 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">No study notes for this topic</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                This tag has associated items, but none are Note chunks. Check the Question Bank for related questions.
              </p>
            </div>
          ) : (
            /* Sequenced Note blocks with chapter-style layout */
            <div className="space-y-6 pb-12">
              {/* Chapter heading */}
              <div className="border-b border-slate-800/60 pb-4">
                <h2 className="text-xl font-extrabold text-white tracking-tight">{selectedTopic.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {notes.length} section{notes.length > 1 ? 's' : ''} from your uploaded documents
                </p>
              </div>

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
                      showSource={!focusMode}
                    />
                  </React.Fragment>
                )
              })}

              {/* Bottom prev/next navigation */}
              <div className="flex justify-between items-center pt-8 border-t border-slate-800/60">
                <button
                  onClick={goToPrevTopic}
                  disabled={currentTopicIndex <= 0}
                  className="flex items-center space-x-2 text-sm font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <div className="text-left">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider block">Previous</span>
                    <span className="truncate max-w-[200px] block">
                      {currentTopicIndex > 0 ? allTopics[currentTopicIndex - 1].name : '—'}
                    </span>
                  </div>
                </button>
                <button
                  onClick={goToNextTopic}
                  disabled={currentTopicIndex >= allTopics.length - 1}
                  className="flex items-center space-x-2 text-sm font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="text-right">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider block">Next</span>
                    <span className="truncate max-w-[200px] block">
                      {currentTopicIndex < allTopics.length - 1 ? allTopics[currentTopicIndex + 1].name : '—'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
