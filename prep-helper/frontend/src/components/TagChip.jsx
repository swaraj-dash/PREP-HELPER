import React from 'react'
import { X } from 'lucide-react'
import { tagColors } from '../utils/tagColors'

export default function TagChip({ name, type = 'concept', size = 'medium', onRemove }) {
  const normalized = type ? type.toLowerCase() : 'concept'
  const mapping = tagColors[normalized] || tagColors.concept

  const sizeClasses = size === 'small'
    ? 'px-1.5 py-0.5 text-[10px] rounded-md'
    : 'px-2.5 py-1 text-[11px] rounded-lg'

  return (
    <span
      className={`inline-flex items-center space-x-1 font-bold border transition-all cursor-default select-none ${mapping.bg} ${mapping.text} ${mapping.border} ${sizeClasses}`}
    >
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:text-rose-450 p-0.5 -mr-1 rounded-sm focus:outline-none transition-colors flex items-center justify-center"
        >
          <X className={size === 'small' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        </button>
      )}
    </span>
  )
}
