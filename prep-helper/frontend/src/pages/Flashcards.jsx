import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  BookOpen, 
  Layers, 
  TrendingUp, 
  HelpCircle,
  Play, 
  X, 
  Calendar,
  Sparkles,
  BarChart2,
  ChevronRight,
  Flame,
  Check
} from 'lucide-react'
import TagFilter from '../components/TagFilter'
import FlashCard from '../components/FlashCard'
import useSRS from '../hooks/useSRS'
import { getTagClasses } from '../utils/tagColors'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Flashcards() {
  const {
    session,
    currentCard,
    queuedCards,
    reviewedCount,
    isComplete,
    loading,
    submittingRating,
    ratingBreakdown,
    startSession,
    submitRating,
    endSession
  } = useSRS()

  // Local state
  const [selectedTags, setSelectedTags] = useState([])
  const [stats, setStats] = useState({
    total_cards: 0,
    due_today: 0,
    mastered: 0,
    learning: 0,
    new: 0
  })
  const [loadingStats, setLoadingStats] = useState(false)
  const [studyAhead, setStudyAhead] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  // Fetch metrics
  const fetchSRSStats = async () => {
    setLoadingStats(true)
    try {
      const res = await api.get('/srs/stats')
      if (res.data) {
        setStats(res.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    fetchSRSStats()
  }, [])

  // Start study session wrapper
  const handleStartSession = async () => {
    await startSession(selectedTags.length > 0 ? selectedTags : null, studyAhead)
  }

  // Handle rating click
  const handleRate = async (rating) => {
    await submitRating(rating)
  }

  // Handle immediate exit
  const handleExitSession = async () => {
    await endSession()
    setConfirmExit(false)
    fetchSRSStats()
    startSession(null) // Reset hook state
  }

  // Finish session and reload stats
  const handleFinish = () => {
    fetchSRSStats()
    startSession(null) // Reset hook state
  }

  // Progress Calculations
  const remainingCardsCount = queuedCards.length + (currentCard ? 1 : 0)
  const totalSessionCards = reviewedCount + remainingCardsCount

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 text-slate-100 animate-fadeIn">
      
      {/* 1. PRE-SESSION SCREEN */}
      {!session && !isComplete && (
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
                <Zap className="h-6 w-6 text-amber-400 fill-amber-400/20" />
              </div>
              <span>Spaced Repetition Flashcards</span>
            </h1>
            <p className="text-slate-400 mt-1.5">
              Reinforce long-term recall using an active retrieval SM-2 scheduler deck.
            </p>
          </div>

          {/* Stats Deck */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            {/* Due Count Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between h-28 shadow-md">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl" />
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Due Today</span>
              <span className={`text-3xl font-black ${stats.due_today > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {loadingStats ? '...' : stats.due_today}
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">Ready for review</span>
            </div>

            {/* Total Cards Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Total Cards</span>
              <span className="text-3xl font-black text-white">
                {loadingStats ? '...' : stats.total_cards}
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">Extracted questions</span>
            </div>

            {/* New Cards Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Unstudied</span>
              <span className="text-3xl font-black text-indigo-400">
                {loadingStats ? '...' : stats.new}
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">Repetitions = 0</span>
            </div>

            {/* Learning Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Learning</span>
              <span className="text-3xl font-black text-pink-400">
                {loadingStats ? '...' : stats.learning}
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">Interval &lt; 21 days</span>
            </div>

            {/* Mastered Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Mastered</span>
              <span className="text-3xl font-black text-emerald-450">
                {loadingStats ? '...' : stats.mastered}
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">Interval &ge; 21 days</span>
            </div>
            
          </div>

          {/* Session Setup Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Setup Panel */}
            <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6">
              
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                  <span>Study Settings</span>
                </h2>
                
                {/* TagFilter component */}
                <TagFilter selectedTags={selectedTags} onChange={setSelectedTags} />
              </div>

              {stats.due_today === 0 && !studyAhead && (
                <div className="bg-emerald-950/10 border border-emerald-950/20 rounded-2xl p-4 flex items-center space-x-3 text-xs leading-relaxed text-emerald-450 animate-fadeIn">
                  <Check className="h-5 w-5 text-emerald-450 shrink-0" />
                  <div className="text-left">
                    <p className="font-bold text-white">🎉 You're all caught up!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      No cards are due for review today. Enable "Study Ahead" below to practice cards anyway.
                    </p>
                  </div>
                </div>
              )}

              {/* Options & study ahead */}
              <div className="border-t border-slate-850 pt-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4 text-left">
                    <label className="text-sm font-bold text-slate-200 block">Study Ahead / Custom Mode</label>
                    <span className="text-xs text-slate-450 block mt-0.5">
                      Enable to review cards ahead of schedule or practice random items if no reviews are due.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={studyAhead}
                    onChange={(e) => setStudyAhead(e.target.checked)}
                    className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartSession}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current" />
                    <span>Start Flashcard Session</span>
                  </>
                )}
              </button>

            </div>

            {/* Right Information Guide Panel */}
            <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 flex flex-col justify-between space-y-4 text-left text-xs leading-relaxed text-slate-400">
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase text-slate-350 tracking-wider flex items-center space-x-1.5">
                  <HelpCircle className="h-4.5 w-4.5 text-indigo-400" />
                  <span>How SRS Works</span>
                </h3>
                <p>
                  Spaced repetition helps you retain coding concepts by spacing out reviews dynamically based on how well you remember them.
                </p>
                <div className="space-y-1.5 border-t border-slate-850/60 pt-3">
                  <p><strong className="text-rose-400 font-bold">Again:</strong> Card is re-enqueued at the end of the session to review immediately.</p>
                  <p><strong className="text-amber-400 font-bold">Hard:</strong> Shorter spacing, decreases card recall ease factor.</p>
                  <p><strong className="text-emerald-450 font-bold">Good:</strong> Spacings scale by the ease factor (reps count increases).</p>
                  <p><strong className="text-blue-450 font-bold">Easy:</strong> Significantly extends scheduling intervals for well-known items.</p>
                </div>
              </div>
              
              <div className="bg-indigo-950/20 border border-indigo-950/50 p-3.5 rounded-2xl text-[11px] text-indigo-400">
                Spaced reviews are calculated per-card using the classic SuperMemo-2 (SM-2) scheduling algorithm.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. ACTIVE SESSION STUDY DECK */}
      {session && !isComplete && (
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Active Header & Progress Indicators */}
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-850 px-5 py-3.5 rounded-2xl text-xs font-bold text-slate-400">
            <span className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span>
                Session Deck {selectedTags.length > 0 ? `(${selectedTags.join(', ')})` : ''}
              </span>
            </span>
            
            <div className="flex items-center space-x-4">
              <span>Card {reviewedCount + 1} of {totalSessionCards}</span>
              <button
                type="button"
                onClick={() => setConfirmExit(true)}
                className="text-slate-500 hover:text-rose-450 p-1 transition-colors"
                title="Exit study session"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 border border-slate-850 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${(reviewedCount / totalSessionCards) * 100}%` }}
            />
          </div>

          {/* FlashCard Component */}
          {currentCard ? (
            <FlashCard 
              question={currentCard} 
              onRate={handleRate} 
              isSubmitting={submittingRating}
            />
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400" />
              <p className="mt-3 font-bold text-sm uppercase tracking-wider">Loading next card...</p>
            </div>
          )}

          {/* Prompt Exit Modal */}
          {confirmExit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative p-6 space-y-4 text-left">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <X className="h-5 w-5 text-rose-450" />
                  <span>Quit Study Session?</span>
                </h3>
                <p className="text-xs text-slate-450 leading-relaxed">
                  Your progress for the {reviewedCount} reviewed card(s) is already saved. Ending the session now will discard the remaining unstudied cards.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmExit(false)}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-350 px-3.5 py-2 rounded-xl text-xs font-semibold"
                  >
                    Continue Study
                  </button>
                  <button
                    type="button"
                    onClick={handleExitSession}
                    className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-rose-600/10"
                  >
                    Quit Session
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. POST-SESSION COMPLETION VIEW */}
      {isComplete && session && (
        <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Ambient complete glow */}
            <div className="absolute top-0 inset-x-0 mx-auto w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
                <Sparkles className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white">Study Session Completed!</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Spaced repetition works best when practiced consistently. Excellent job wrapping up today's reviews!
              </p>
            </div>

            {/* Metrics cards row */}
            <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-800/60 py-5 my-4">
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Reviewed</span>
                <span className="text-3xl font-black text-white mt-1">{reviewedCount}</span>
                <span className="text-[9px] text-slate-450 mt-0.5">Flashcards</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Performance</span>
                <span className="text-3xl font-black text-indigo-400 mt-1">
                  {reviewedCount > 0 
                    ? Math.round(((ratingBreakdown.good + ratingBreakdown.easy) / reviewedCount) * 100)
                    : 0}%
                </span>
                <span className="text-[9px] text-slate-450 mt-0.5">Recall accuracy</span>
              </div>
            </div>

            {/* Horizontal breakdown charts */}
            {reviewedCount > 0 && (
              <div className="space-y-2 text-left">
                <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center space-x-1">
                  <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Recall Breakdown</span>
                </h3>
                
                <div className="space-y-2.5">
                  {/* Good Rating */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-emerald-450">Good</span>
                      <span className="text-slate-300">{ratingBreakdown.good}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(ratingBreakdown.good / reviewedCount) * 100}%` }} />
                    </div>
                  </div>

                  {/* Easy Rating */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-blue-400">Easy</span>
                      <span className="text-slate-300">{ratingBreakdown.easy}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${(ratingBreakdown.easy / reviewedCount) * 100}%` }} />
                    </div>
                  </div>

                  {/* Hard Rating */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-amber-400">Hard</span>
                      <span className="text-slate-300">{ratingBreakdown.hard}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${(ratingBreakdown.hard / reviewedCount) * 100}%` }} />
                    </div>
                  </div>

                  {/* Again Rating */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-rose-455">Again</span>
                      <span className="text-slate-300">{ratingBreakdown.again}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${(ratingBreakdown.again / reviewedCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Back Button */}
            <button
              type="button"
              onClick={handleFinish}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2"
            >
              <span>Back to Library</span>
              <ChevronRight className="h-4.5 w-4.5" />
            </button>

          </div>

        </div>
      )}

    </div>
  )
}
