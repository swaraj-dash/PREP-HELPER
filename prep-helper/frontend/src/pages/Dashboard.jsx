import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  Flame, 
  Zap, 
  BookOpen, 
  Layers, 
  FileText,
  AlertTriangle,
  UploadCloud,
  ChevronRight,
  TrendingUp,
  Compass
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import StudyHeatmap from '../components/StudyHeatmap'
import { StatsCardSkeleton } from '../components/ui/Skeleton'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [data, setData] = useState({
    streak: 0,
    heatmap: [],
    topic_coverage: [],
    weak_areas: [],
    stats: {
      total_documents: 0,
      total_questions: 0,
      due_today: 0
    }
  })
  const [recentDocs, setRecentDocs] = useState([])

  const fetchDashboardData = async () => {
    setLoading(true)
    setHasError(false)
    try {
      const res = await api.get('/progress/dashboard')
      if (res.data) {
        setData(res.data)
      }
      
      const docsRes = await api.get('/documents')
      if (docsRes.data) {
        setRecentDocs(docsRes.data.slice(0, 3)) // Show only last 3 documents
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  if (hasError) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 text-center space-y-6 animate-fadeIn">
        <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-455">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Failed to load dashboard metrics</h2>
          <p className="text-slate-450 text-sm leading-relaxed max-w-sm mx-auto">
            There was a connection issue or system error loading metrics. Please verify the backend service is running.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry Loading Dashboard</span>
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn text-slate-100 text-left">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center border-b border-slate-900 pb-6">
          <div className="space-y-2">
            <div className="h-8 w-60 animate-pulse bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 animate-pulse bg-slate-800 rounded-lg" />
          </div>
          <div className="h-11 w-48 animate-pulse bg-slate-800 rounded-xl" />
        </div>
        
        {/* Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Heatmap Skeleton */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-40 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse bg-slate-800 rounded-lg" />
            <div className="h-3 w-64 animate-pulse bg-slate-800 rounded-lg" />
          </div>
          <div className="h-16 w-full animate-pulse bg-slate-800 rounded-xl mt-4" />
        </div>

        {/* Core Analytics Split Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-80 space-y-4">
            <div className="h-4 w-40 animate-pulse bg-slate-800 rounded-lg" />
            <div className="space-y-3">
              <div className="h-8 w-full animate-pulse bg-slate-800 rounded-xl" />
              <div className="h-8 w-full animate-pulse bg-slate-800 rounded-xl" />
              <div className="h-8 w-full animate-pulse bg-slate-800 rounded-xl" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-36 flex flex-col justify-between">
              <div className="h-4 w-48 animate-pulse bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="h-7 w-full animate-pulse bg-slate-800 rounded-lg" />
                <div className="h-7 w-full animate-pulse bg-slate-800 rounded-lg" />
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-36 flex flex-col justify-between">
              <div className="h-4 w-48 animate-pulse bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="h-7 w-full animate-pulse bg-slate-800 rounded-lg" />
                <div className="h-7 w-full animate-pulse bg-slate-800 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasDocs = data.stats.total_documents > 0

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn text-slate-100">
      
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
            <span>Study Hub Dashboard</span>
          </h1>
          <p className="text-slate-400 mt-1">
            Welcome back! Monitor recall progress and practice active recall sessions.
          </p>
        </div>

        {/* Quick study button */}
        {hasDocs && (
          <NavLink
            to="/flashcards"
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10"
          >
            <Zap className="h-4.5 w-4.5 fill-current" />
            <span>Practice Flashcards ({data.stats.due_today})</span>
          </NavLink>
        )}
      </div>

      {!hasDocs ? (
        /* Empty State */
        <div className="glow-card rounded-3xl p-12 bg-slate-900/40 border border-slate-800 text-center space-y-6 max-w-xl mx-auto mt-12">
          <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
            <UploadCloud className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">No documents uploaded yet</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              Get started by uploading your first Q&A document, slide deck, or interview notes PDF to build your custom study bank.
            </p>
          </div>

          <div className="pt-2">
            <NavLink
              to="/upload"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10"
            >
              <span>Upload Your First PDF</span>
            </NavLink>
          </div>
        </div>
      ) : (
        /* Dashboard Content */
        <div className="space-y-8">
          
          {/* Analytics stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Streak */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl transition-all duration-300 group-hover:scale-125" />
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-extrabold tracking-wider">Study Streak</span>
                <Flame className={`h-5 w-5 ${data.streak > 0 ? 'text-orange-500 fill-orange-500/20' : 'text-slate-500'}`} />
              </div>
              <span className="text-3xl font-black text-white">{data.streak} Days</span>
              <span className="text-[9px] text-slate-450 font-semibold">Keep the fire burning!</span>
            </div>

            {/* Due Today */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl transition-all duration-300 group-hover:scale-125" />
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-extrabold tracking-wider">Due Today</span>
                <Zap className={`h-5 w-5 ${data.stats.due_today > 0 ? 'text-amber-400 fill-amber-450/20' : 'text-slate-500'}`} />
              </div>
              <span className={`text-3xl font-black ${data.stats.due_today > 0 ? 'text-amber-400' : 'text-emerald-450'}`}>
                {data.stats.due_today} Cards
              </span>
              <span className="text-[9px] text-slate-450 font-semibold">SRS cards pending</span>
            </div>

            {/* Total Questions */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl transition-all duration-300 group-hover:scale-125" />
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-extrabold tracking-wider">Total Questions</span>
                <BookOpen className="h-5 w-5 text-indigo-400" />
              </div>
              <span className="text-3xl font-black text-white">{data.stats.total_questions} Items</span>
              <span className="text-[9px] text-slate-450 font-semibold">Total recall database</span>
            </div>

            {/* Total Documents */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl transition-all duration-300 group-hover:scale-125" />
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-extrabold tracking-wider">My Documents</span>
                <Layers className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-3xl font-black text-white">{data.stats.total_documents} Files</span>
              <span className="text-[9px] text-slate-450 font-semibold">Processed library items</span>
            </div>

          </div>

          {/* Activity Heatmap Grid */}
          <StudyHeatmap data={data.heatmap} />

          {/* Core Analytics Split Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Panel A: Concept Topic Coverage */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4 text-left">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Concept Topic Coverage</span>
                </h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Top studied topics and mastery rates.</p>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin divide-y divide-slate-850/60">
                {data.topic_coverage.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No studied topic tags available yet.</p>
                ) : (
                  data.topic_coverage.slice(0, 10).map((topic, index) => {
                    const reviewedPct = Math.round((topic.reviewed_once / topic.total_questions) * 100)
                    const masteredPct = Math.round((topic.mastered / topic.total_questions) * 100)

                    return (
                      <div key={topic.tag_name} className={`space-y-1.5 ${index > 0 ? 'pt-3.5' : ''}`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">{topic.tag_name}</span>
                          <span className="text-slate-400 font-semibold text-[10px]">
                            {topic.reviewed_once}/{topic.total_questions} studied ({masteredPct}% mastered)
                          </span>
                        </div>
                        {/* Overlay Progress Bar */}
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden relative flex">
                          <div 
                            className="bg-indigo-600/40 h-full rounded-l-full" 
                            style={{ width: `${reviewedPct}%` }}
                            title={`Reviewed Once: ${reviewedPct}%`}
                          />
                          <div 
                            className="bg-emerald-500 h-full rounded-r-full absolute top-0 left-0" 
                            style={{ width: `${masteredPct}%` }}
                            title={`Mastered: ${masteredPct}%`}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Panel B: Weak Areas & Recent Documents */}
            <div className="space-y-6">
              
              {/* Card 1: Weak Areas */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4 text-left">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-455" />
                    <span>Concepts Needing Practice</span>
                  </h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Topics with the lowest ease factor ratings.</p>
                </div>

                <div className="space-y-2.5">
                  {data.weak_areas.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No weak areas identified. Good job!</p>
                  ) : (
                    data.weak_areas.map((area) => (
                      <div 
                        key={area.tag_name}
                        className="bg-rose-950/10 border border-rose-950/30 px-4 py-3 rounded-2xl flex justify-between items-center text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-rose-300">{area.tag_name}</span>
                          <span className="text-[10px] text-slate-500 block font-semibold">
                            {area.question_count} cards logged
                          </span>
                        </div>
                        <span className="bg-rose-950/40 border border-rose-900/40 text-rose-400 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase">
                          EF: {area.avg_ease}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Card 2: Recent Documents */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Uploads</h3>
                    <p className="text-[11px] text-slate-450 mt-0.5">Last processed files inside local vault.</p>
                  </div>
                  <NavLink to="/documents" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-0.5">
                    <span>View All</span>
                    <ChevronRight className="h-4 w-4" />
                  </NavLink>
                </div>

                <div className="space-y-2.5">
                  {recentDocs.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">No documents in library.</p>
                  ) : (
                    recentDocs.map((doc) => (
                      <div 
                        key={doc.id}
                        className="bg-slate-950/40 border border-slate-850 px-4 py-2.5 rounded-2xl flex justify-between items-center text-xs"
                      >
                        <div className="space-y-0.5 truncate max-w-[200px]">
                          <span className="font-bold text-slate-200 truncate block" title={doc.original_name}>
                            {doc.original_name}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-semibold">
                            {doc.question_count} questions / {doc.note_count} notes
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded border text-[9px] uppercase font-bold ${
                          doc.status === 'done' ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-450' :
                          doc.status === 'error' ? 'bg-rose-950/30 border-rose-900/60 text-rose-455' :
                          'bg-indigo-950/30 border-indigo-900/60 text-indigo-400'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}
