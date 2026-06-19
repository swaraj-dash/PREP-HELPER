import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Sparkles, RefreshCw, Eye } from 'lucide-react'
import TagChip from './TagChip'

export default function FlashCard({ question, onRate, isSubmitting = false }) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleRateClick = (e, rating) => {
    e.stopPropagation() // Prevent card flip when clicking buttons
    setIsFlipped(false) // Flip back for next card
    onRate(rating)
  }

  const cardStyle = {
    perspective: '1500px',
  }

  return (
    <div className="w-full max-w-2xl mx-auto h-[400px] cursor-pointer" style={cardStyle} onClick={handleFlip}>
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* CARD FRONT SIDE */}
        <div
          className="absolute inset-0 w-full h-full bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl backdrop-blur-md"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Ambient Glow */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Indicator */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-extrabold tracking-widest relative z-10">
            <span className="flex items-center space-x-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Recall Challenge</span>
            </span>
            <span className={`px-2 py-0.5 rounded border ${
              question.difficulty === 'beginner' ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-450' :
              question.difficulty === 'advanced' ? 'bg-rose-950/20 border-rose-900/50 text-rose-455' :
              'bg-amber-950/20 border-amber-900/50 text-amber-450'
            }`}>
              {question.difficulty || 'intermediate'}
            </span>
          </div>

          {/* Question Text */}
          <div className="flex-1 flex items-center justify-center py-6 relative z-10 select-text" onClick={(e) => e.stopPropagation()}>
            <p className="text-xl font-bold text-slate-100 text-center leading-relaxed max-w-lg">
              {question.question_text}
            </p>
          </div>

          {/* Bottom attribution & Tags */}
          <div className="space-y-4 border-t border-slate-800/40 pt-4 relative z-10">
            {question.tags && question.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {question.tags.map((tag) => (
                  <TagChip key={tag.id} name={tag.name} type={tag.tag_type} size="small" />
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span className="flex items-center space-x-1">
                <FileText className="h-3.5 w-3.5 text-slate-600" />
                <span className="truncate max-w-[200px]" title="Attribution">From study vault</span>
              </span>
              <span className="text-indigo-400 flex items-center space-x-1">
                <Eye className="h-3.5 w-3.5" />
                <span>Click to Flip</span>
              </span>
            </div>
          </div>
        </div>

        {/* CARD BACK SIDE */}
        <div
          className="absolute inset-0 w-full h-full bg-slate-900/85 border border-indigo-950/50 rounded-3xl p-8 flex flex-col justify-between shadow-2xl backdrop-blur-lg"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {/* Ambient Glow */}
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Indicator */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-extrabold tracking-widest relative z-10">
            <span>Answer reveal</span>
            <span className="text-emerald-450">Flipped view</span>
          </div>

          {/* Answer Text */}
          <div className="flex-1 overflow-y-auto my-4 py-2 relative z-10 scrollbar-thin select-text" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {question.answer_text}
            </p>
          </div>

          {/* Rating Selection Action Row */}
          <div className="space-y-4 border-t border-slate-800/60 pt-4 relative z-10" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
              How well did you recall this?
            </p>
            
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleRateClick(e, 'again')}
                className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl py-2 px-1 text-xs font-bold transition-all disabled:opacity-50 flex flex-col items-center justify-center"
              >
                <span>Again</span>
                <span className="text-[9px] opacity-75 font-normal">1d</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleRateClick(e, 'hard')}
                className="bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 rounded-xl py-2 px-1 text-xs font-bold transition-all disabled:opacity-50 flex flex-col items-center justify-center"
              >
                <span>Hard</span>
                <span className="text-[9px] opacity-75 font-normal">1.2x</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleRateClick(e, 'good')}
                className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-450 hover:text-white border border-emerald-500/20 rounded-xl py-2 px-1 text-xs font-bold transition-all disabled:opacity-50 flex flex-col items-center justify-center"
              >
                <span>Good</span>
                <span className="text-[9px] opacity-75 font-normal">Grad</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleRateClick(e, 'easy')}
                className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl py-2 px-1 text-xs font-bold transition-all disabled:opacity-50 flex flex-col items-center justify-center"
              >
                <span>Easy</span>
                <span className="text-[9px] opacity-75 font-normal">Grad+</span>
              </button>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  )
}
