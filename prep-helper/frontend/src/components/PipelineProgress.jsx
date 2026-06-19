import React from 'react'
import { Check, Loader, AlertCircle, FileText, HelpCircle, Layers, Tag, Database } from 'lucide-react'

export default function PipelineProgress({ stage, progress, message, details, isComplete, isError, errorMessage }) {
  
  const steps = [
    { name: 'Extract', icon: FileText, label: 'extracting' },
    { name: 'Classify', icon: HelpCircle, label: 'classifying' },
    { name: 'Chunk', icon: Layers, label: 'chunking' },
    { name: 'Tag', icon: Tag, label: 'tagging' },
    { name: 'Embed', icon: Database, label: 'embedding' },
  ]

  const getStepStatus = (stepLabel, stepIdx) => {
    const stageOrder = ['queued', 'extracting', 'classifying', 'chunking', 'tagging', 'embedding', 'done', 'error']
    const currentIdx = stageOrder.indexOf(stage)
    const stepTargetIdx = stageOrder.indexOf(stepLabel)

    if (isError) {
      if (currentIdx === stepTargetIdx) return 'error'
      return stepTargetIdx < currentIdx ? 'complete' : 'pending'
    }

    if (isComplete || currentIdx > stepTargetIdx) {
      return 'complete'
    }
    if (currentIdx === stepTargetIdx) {
      return 'active'
    }
    return 'pending'
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 max-w-2xl mx-auto space-y-8 shadow-2xl relative overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Ingestion Pipeline Progress</h3>
          <p className="text-slate-400 text-sm mt-1">Analyzing and indexing your document locally...</p>
        </div>
        {isComplete && (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1">
            <Check className="h-4 w-4" />
            <span>Success</span>
          </span>
        )}
        {isError && (
          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1">
            <AlertCircle className="h-4 w-4" />
            <span>Error</span>
          </span>
        )}
        {!isComplete && !isError && (
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1.5 animate-pulse">
            <Loader className="h-3.5 w-3.5 animate-spin" />
            <span>Processing</span>
          </span>
        )}
      </div>

      {/* Stepper Timeline */}
      <div className="relative flex justify-between items-center w-full">
        {/* Connector Line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 z-0" />
        
        {/* Dynamic completed bar */}
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 z-0"
          style={{ width: `${Math.min(100, Math.max(0, (progress - 10) * 1.25))}%` }}
        />

        {steps.map((step, idx) => {
          const status = getStepStatus(step.label, idx)
          const StepIcon = step.icon

          return (
            <div key={step.name} className="relative z-10 flex flex-col items-center group">
              <div 
                className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                  status === 'complete'
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-500 border-transparent text-white shadow-lg shadow-indigo-500/25'
                    : status === 'active'
                    ? 'bg-slate-900 border-indigo-500 text-indigo-400 shadow-md ring-4 ring-indigo-500/10'
                    : status === 'error'
                    ? 'bg-rose-950 border-rose-500 text-rose-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                {status === 'complete' ? (
                  <Check className="h-5 w-5" />
                ) : status === 'active' ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
              </div>
              <span className={`text-[11px] font-bold mt-2.5 tracking-wider uppercase transition-colors duration-300 ${
                status === 'active' ? 'text-indigo-400' : status === 'complete' ? 'text-slate-300' : status === 'error' ? 'text-rose-400' : 'text-slate-600'
              }`}>
                {step.name}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress Bar & Description */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-400">{message}</span>
          <span className="text-indigo-400">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/40">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Details Box */}
      {isComplete && details && Object.keys(details).length > 0 && (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-5 space-y-4 animate-fadeIn">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Ingestion Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-900 border border-slate-800/40 rounded-xl">
              <span className="block text-2xl font-black text-white">{details.questions_found || 0}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Q&A Flashcards</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/40 rounded-xl">
              <span className="block text-2xl font-black text-white">{details.notes_found || 0}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Notes Chunks</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/40 rounded-xl">
              <span className="block text-2xl font-black text-white">{details.chunks_processed || 0}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Chunks</span>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 space-y-2 animate-shake text-left">
          <div className="flex items-center space-x-2 text-rose-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <h4 className="text-sm font-bold uppercase tracking-wider">Pipeline Failure</h4>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800/40 select-all overflow-x-auto">
            {errorMessage || 'An error occurred during pipeline run.'}
          </p>
          <p className="text-xs text-slate-500">
            Troubleshooting: Verify that your API keys are correct, local directories are writable, and you are online.
          </p>
        </div>
      )}
    </div>
  )
}
