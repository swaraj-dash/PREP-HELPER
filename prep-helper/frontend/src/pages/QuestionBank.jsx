import React, { useState, useEffect } from 'react'
import { BookOpen, Search, Filter, Loader, RefreshCw, Star, HelpCircle } from 'lucide-react'
import api from '../api/client'
import TagFilter from '../components/TagFilter'
import QuestionCard from '../components/QuestionCard'
import { QuestionCardSkeleton } from '../components/ui/Skeleton'

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  // Filters state
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [difficulty, setDifficulty] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  const [limit, setLimit] = useState(12)
  const [offset, setOffset] = useState(0)
  
  // Triggers loading more items
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchQuestions = async (resetList = true) => {
    if (resetList) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      // Build query string params
      const params = new URLSearchParams()
      
      // Repeated tag parameters for AND logic
      if (selectedTags.length > 0) {
        selectedTags.forEach((t) => params.append('tags', t))
      }
      
      if (search.trim()) params.append('search', search.trim())
      if (difficulty) params.append('difficulty', difficulty)
      if (bookmarked) params.append('bookmarked', 'true')
      
      const currentOffset = resetList ? 0 : offset
      params.append('limit', limit)
      params.append('offset', currentOffset)

      const res = await api.get(`/questions?${params.toString()}`)
      
      if (res.data) {
        if (resetList) {
          setQuestions(res.data.data)
        } else {
          setQuestions((prev) => [...prev, ...res.data.data])
        }
        setTotalCount(res.data.meta.total)
      }
    } catch (err) {
      console.error('Failed to load questions:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Refetch on filter changes
  useEffect(() => {
    fetchQuestions(true)
  }, [selectedTags, difficulty, bookmarked])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchQuestions(true)
  }

  const handleLoadMore = () => {
    const nextOffset = offset + limit
    setOffset(nextOffset)
    // We need to trigger fetch with nextOffset, so we call it directly
    // Wait, updating state is async, so we'll pass the next offset directly to fetchQuestions
    setOffset(nextOffset)
  }

  // Trigger loading more when offset updates and is not zero
  useEffect(() => {
    if (offset > 0) {
      fetchQuestions(false)
    }
  }, [offset])

  const handleCardUpdate = (updatedQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
    )
  }

  const handleCardDelete = (deletedId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== deletedId))
    setTotalCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Question Bank</h1>
          <p className="text-slate-400 mt-1">Review Q&A flashcards, edit details, and run semantic queries over your knowledge base.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Side: Filter Panel */}
        <aside className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6 h-fit">
          <div className="flex items-center space-x-2 text-white border-b border-slate-800/60 pb-3">
            <Filter className="h-4.5 w-4.5 text-indigo-400" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Search Filters</h2>
          </div>

          {/* Tag Filter autocomplete */}
          <TagFilter selectedTags={selectedTags} onChange={setSelectedTags} />

          {/* Difficulty filter */}
          <div className="space-y-2 text-left">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Bookmarked Filter */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-left">
            <label className="text-sm font-semibold text-slate-355 flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bookmarked}
                onChange={(e) => setBookmarked(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="flex items-center space-x-1">
                <Star className={`h-4 w-4 ${bookmarked ? 'text-amber-400 fill-current' : 'text-slate-500'}`} />
                <span>Bookmarked Only</span>
              </span>
            </label>
          </div>
        </aside>

        {/* Right Side: Search bar & Questions list */}
        <main className="lg:col-span-3 space-y-6">
          {/* Semantic Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex space-x-3 bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-2xl p-2 transition-colors">
            <div className="relative flex-1 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ask semantically (e.g. 'explain transformer self-attention') or keyword search..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-600 focus:outline-none py-2"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10 text-sm"
            >
              Search
            </button>
          </form>

          {/* Result count stats */}
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold px-1">
            <span>
              {search.trim() ? 'Semantic matches' : 'Questions found'}: {totalCount}
            </span>
            {selectedTags.length > 0 && (
              <span className="text-indigo-400">
                Matching: {selectedTags.map(t => `[${t}]`).join(' ')}
              </span>
            )}
          </div>

          {/* Loading States */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <QuestionCardSkeleton />
              <QuestionCardSkeleton />
              <QuestionCardSkeleton />
              <QuestionCardSkeleton />
            </div>
          ) : questions.length === 0 ? (
            /* Empty State */
            <div className="glow-card border border-slate-800 rounded-3xl p-20 text-center space-y-6">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <HelpCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">No questions matched filters</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Try clearing tag selectors, searching for broader terms, or uploading more documents.
                </p>
              </div>
              {(selectedTags.length > 0 || search || difficulty || bookmarked) && (
                <button
                  onClick={() => {
                    setSelectedTags([])
                    setSearch('')
                    setDifficulty('')
                    setBookmarked(false)
                  }}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-6 py-3 rounded-xl transition-all text-sm font-semibold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            /* Question Cards grid */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    onUpdate={handleCardUpdate}
                    onDelete={handleCardDelete}
                  />
                ))}
              </div>

              {/* Load More Pagination */}
              {questions.length < totalCount && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold px-8 py-3.5 rounded-xl transition-all flex items-center space-x-2 disabled:opacity-50 text-sm"
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        <span>Loading more...</span>
                      </>
                    ) : (
                      <span>Load More Questions</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
