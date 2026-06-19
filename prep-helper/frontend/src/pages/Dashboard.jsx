import React from 'react'
import { NavLink } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-400 mt-1">Welcome to Prep Helper! Track your progress and study sessions.</p>
      </div>

      {/* Fresh Vault Empty State */}
      <div className="glow-card rounded-2xl p-12 bg-slate-900/40 border border-slate-800 text-center space-y-6 max-w-xl mx-auto mt-12">
        <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
          <UploadCloud className="h-8 w-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">No documents uploaded yet</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            Get started by uploading your first Q&A document, slide deck, or interview notes PDF.
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
    </div>
  )
}
