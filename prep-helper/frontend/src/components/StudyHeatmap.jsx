import React, { useState, useMemo } from 'react'

export default function StudyHeatmap({ data = [] }) {
  const [tooltip, setTooltip] = useState(null) // { x, y, text }

  // Create a map of date string -> count for fast lookups
  const dataMap = useMemo(() => {
    const map = {}
    data.forEach((d) => {
      map[d.date] = d.count
    });
    return map
  }, [data])

  // Generate date cells for the past 365 days, aligned to weeks
  const cells = useMemo(() => {
    const list = []
    const today = new Date()
    
    // Find the starting Sunday of the grid (~52 weeks ago)
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 364)
    const startDay = startDate.getDay() // 0 = Sun, 1 = Mon...
    
    // Align grid start to Sunday
    startDate.setDate(startDate.getDate() - startDay)

    const currentDate = new Date(startDate)
    
    // Generate exactly 53 weeks (371 days) to fill the grid columns
    for (let w = 0; w < 53; w++) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const count = dataMap[dateStr] || 0
        
        week.push({
          date: dateStr,
          count,
          dayOfWeek: d,
          isFuture: currentDate > today
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      list.push(week)
    }
    return list
  }, [dataMap])

  // Get color scale based on reviews count
  const getColor = (count, isFuture) => {
    if (isFuture) return '#1e293b/20' // transparent/slate-800 for future dates
    if (count === 0) return '#1e293b'  // Slate-800
    if (count <= 2) return '#064e3b'   // Emerald-900 (light)
    if (count <= 5) return '#047857'   // Emerald-700 (medium)
    return '#10b981'                   // Emerald-500 (bright/active)
  }

  const handleMouseEnter = (e, cell) => {
    if (cell.isFuture) return
    const rect = e.target.getBoundingClientRect()
    
    const formattedDate = new Date(cell.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    setTooltip({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 36,
      text: `${formattedDate}: ${cell.count} review${cell.count === 1 ? '' : 's'} logged`
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  // Width and height mapping for SVG
  const cellSize = 10
  const cellGap = 2
  const weekWidth = cellSize + cellGap
  const totalWidth = 53 * weekWidth
  const totalHeight = 7 * weekWidth

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg text-left relative">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Study Consistency Heatmap</h3>
          <p className="text-[11px] text-slate-450">Review frequency mapped across the past 12 months.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider select-none">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded bg-[#1e293b]" />
          <div className="w-2.5 h-2.5 rounded bg-[#064e3b]" />
          <div className="w-2.5 h-2.5 rounded bg-[#047857]" />
          <div className="w-2.5 h-2.5 rounded bg-[#10b981]" />
          <span>More</span>
        </div>
      </div>

      {/* SVG Grid */}
      <div className="overflow-x-auto pt-1 scrollbar-thin">
        <svg 
          viewBox={`0 0 ${totalWidth} ${totalHeight}`} 
          width="100%" 
          height="100%" 
          className="min-w-[620px] select-none"
        >
          {cells.map((week, wIndex) => (
            <g key={wIndex} transform={`translate(${wIndex * weekWidth}, 0)`}>
              {week.map((cell, dIndex) => (
                <rect
                  key={cell.date}
                  y={dIndex * weekWidth}
                  width={cellSize}
                  height={cellSize}
                  rx="1.5"
                  fill={getColor(cell.count, cell.isFuture)}
                  opacity={cell.isFuture ? 0.2 : 1}
                  onMouseEnter={(e) => handleMouseEnter(e, cell)}
                  onMouseLeave={handleMouseLeave}
                  className="transition-all duration-150 hover:stroke-indigo-400 hover:stroke-[1.5px]"
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* Tooltip Overlay */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-200 px-2.5 py-1.5 rounded-lg shadow-2xl animate-fadeIn -translate-x-1/2 whitespace-nowrap"
          style={{
            left: `${tooltip.x - window.scrollX - 235}px`, // Adjusted offset relative to parent box
            top: `${tooltip.y - window.scrollY - 150}px`
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
