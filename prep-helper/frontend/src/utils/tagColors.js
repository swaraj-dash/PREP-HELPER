export const tagColors = {
  tech: {
    bg: 'bg-blue-500/10 hover:bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/30',
  },
  concept: {
    bg: 'bg-purple-500/10 hover:bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/20 hover:border-purple-500/30',
  },
  domain: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20 hover:border-emerald-500/30',
  },
  difficulty: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/20 hover:border-amber-500/30',
  },
  content_type: {
    bg: 'bg-slate-500/10 hover:bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/20 hover:border-slate-500/30',
  },
  custom: {
    bg: 'bg-pink-500/10 hover:bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/20 hover:border-pink-500/30',
  },
}

export function getTagClasses(type = 'concept') {
  const normalized = type.toLowerCase()
  const mapping = tagColors[normalized] || tagColors.concept
  return `px-2.5 py-1 text-[11px] font-bold border rounded-lg transition-colors cursor-default select-none ${mapping.bg} ${mapping.text} ${mapping.border}`
}
