import React from 'react'

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Helper to parse inline markdown (bold, italic, inline code, strikethrough, links).
 */
function parseInline(text) {
  let escaped = escapeHtml(text)
  
  // Replace bold: **text** -> <strong>
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-extrabold">$1</strong>')
  
  // Replace italic: *text* or _text_ (but not inside words for underscore)
  escaped = escaped.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em class="text-slate-200 italic">$1</em>')
  escaped = escaped.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em class="text-slate-200 italic">$1</em>')
  
  // Replace inline code: `code`
  escaped = escaped.replace(/`(.*?)`/g, '<code class="bg-slate-950 border border-slate-800/60 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-[11px] font-semibold">$1</code>')
  
  // Replace strikethrough: ~~text~~
  escaped = escaped.replace(/~~(.*?)~~/g, '<del class="text-slate-500 line-through">$1</del>')
  
  // Replace links: [text](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">$1</a>')
  
  return escaped
}

export default function MarkdownRenderer({ text }) {
  if (!text) return null

  // Normalise line endings and identify code blocks first
  const blocks = []
  const rawBlocks = text.split(/(```[\s\S]*?```)/)

  for (const block of rawBlocks) {
    if (block.startsWith('```') && block.endsWith('```')) {
      // Extract code block content and language if specified
      const match = block.match(/```(\w*)\n([\s\S]*?)```/)
      if (match) {
        blocks.push({
          type: 'code',
          lang: match[1] || '',
          content: match[2].trim()
        })
      } else {
        blocks.push({
          type: 'code',
          lang: '',
          content: block.slice(3, -3).trim()
        })
      }
    } else {
      // Split non-code block segments into paragraphs/lists/headings
      const paragraphs = block.split(/\n\n+/)
      for (const p of paragraphs) {
        const trimmed = p.trim()
        if (!trimmed) continue

        // Check for multi-line content within this paragraph
        const subLines = trimmed.split('\n')
        
        // Single-line heading checks
        if (subLines.length === 1 || subLines[0].startsWith('#')) {
          const firstLine = subLines[0].trim()
          
          if (firstLine.startsWith('#### ')) {
            blocks.push({ type: 'h4', text: firstLine.slice(5).trim() })
            // Process remaining lines if any
            if (subLines.length > 1) {
              const rest = subLines.slice(1).join('\n').trim()
              if (rest) blocks.push({ type: 'p', text: rest })
            }
            continue
          }
          if (firstLine.startsWith('### ')) {
            blocks.push({ type: 'h3', text: firstLine.slice(4).trim() })
            if (subLines.length > 1) {
              const rest = subLines.slice(1).join('\n').trim()
              if (rest) blocks.push({ type: 'p', text: rest })
            }
            continue
          }
          if (firstLine.startsWith('## ')) {
            blocks.push({ type: 'h2', text: firstLine.slice(3).trim() })
            if (subLines.length > 1) {
              const rest = subLines.slice(1).join('\n').trim()
              if (rest) blocks.push({ type: 'p', text: rest })
            }
            continue
          }
          if (firstLine.startsWith('# ')) {
            blocks.push({ type: 'h1', text: firstLine.slice(2).trim() })
            if (subLines.length > 1) {
              const rest = subLines.slice(1).join('\n').trim()
              if (rest) blocks.push({ type: 'p', text: rest })
            }
            continue
          }
        }

        // Check for blockquote: > text
        if (trimmed.startsWith('> ')) {
          const quoteLines = subLines
            .filter((l) => l.trim().startsWith('> '))
            .map((l) => l.trim().slice(2).trim())
          blocks.push({ type: 'blockquote', text: quoteLines.join('\n') })
          continue
        }

        // Check for unordered list: lines starting with - or *
        if (subLines.every((l) => /^\s*[-*]\s+/.test(l) || !l.trim())) {
          const items = subLines
            .filter((l) => l.trim())
            .map((item) => item.replace(/^\s*[-*]\s+/, '').trim())
            .filter(Boolean)
          if (items.length > 0) {
            blocks.push({ type: 'ul', items })
            continue
          }
        }

        // Check for ordered list: lines starting with digits
        if (subLines.every((l) => /^\s*\d+[\.\)]\s+/.test(l) || !l.trim())) {
          const items = subLines
            .filter((l) => l.trim())
            .map((item) => item.replace(/^\s*\d+[\.\)]\s+/, '').trim())
            .filter(Boolean)
          if (items.length > 0) {
            blocks.push({ type: 'ol', items })
            continue
          }
        }

        // Check for horizontal rule: --- or ***
        if (/^[-*_]{3,}\s*$/.test(trimmed)) {
          blocks.push({ type: 'hr' })
          continue
        }

        // Check for table: lines containing | separators
        if (subLines.length >= 2 && subLines[0].includes('|') && subLines[1].includes('---')) {
          const headers = subLines[0].split('|').map((h) => h.trim()).filter(Boolean)
          const rows = subLines.slice(2).map((row) =>
            row.split('|').map((c) => c.trim()).filter(Boolean)
          ).filter((r) => r.length > 0)
          blocks.push({ type: 'table', headers, rows })
          continue
        }

        // Mixed content: some lines are list items, some are text — handle inline
        // Check if the paragraph contains headings inline
        let hasInlineHeadings = false
        for (const line of subLines) {
          const l = line.trim()
          if (/^#{1,4}\s+/.test(l)) {
            hasInlineHeadings = true
            break
          }
        }

        if (hasInlineHeadings) {
          // Process each line individually
          for (const line of subLines) {
            const l = line.trim()
            if (!l) continue
            if (l.startsWith('#### ')) blocks.push({ type: 'h4', text: l.slice(5).trim() })
            else if (l.startsWith('### ')) blocks.push({ type: 'h3', text: l.slice(4).trim() })
            else if (l.startsWith('## ')) blocks.push({ type: 'h2', text: l.slice(3).trim() })
            else if (l.startsWith('# ')) blocks.push({ type: 'h1', text: l.slice(2).trim() })
            else if (/^\s*[-*]\s+/.test(l)) blocks.push({ type: 'ul', items: [l.replace(/^\s*[-*]\s+/, '').trim()] })
            else if (/^\s*\d+[\.\)]\s+/.test(l)) blocks.push({ type: 'ol', items: [l.replace(/^\s*\d+[\.\)]\s+/, '').trim()] })
            else blocks.push({ type: 'p', text: l })
          }
          continue
        }

        // Normal paragraph text — preserve single newlines as line breaks
        blocks.push({ type: 'p', text: trimmed })
      }
    }
  }

  return (
    <div className="space-y-3 text-left font-normal select-text">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={idx}
                className="text-lg font-extrabold text-white mt-5 mb-2 tracking-tight border-b border-slate-800 pb-1.5"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
          case 'h2':
            return (
              <h2
                key={idx}
                className="text-base font-bold text-white mt-5 mb-2 tracking-tight"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
          case 'h3':
            return (
              <h3
                key={idx}
                className="text-sm font-bold text-indigo-300 mt-4 mb-1.5"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
          case 'h4':
            return (
              <h4
                key={idx}
                className="text-xs font-bold text-slate-200 mt-3 mb-1 uppercase tracking-wider"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
          case 'code':
            return (
              <div key={idx} className="relative group my-3">
                {block.lang && (
                  <span className="absolute top-2 right-3 text-[9px] font-extrabold text-slate-600 uppercase tracking-widest select-none">
                    {block.lang}
                  </span>
                )}
                <pre className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/60 overflow-x-auto text-xs font-mono shadow-inner text-slate-300 leading-relaxed">
                  <code>{block.content}</code>
                </pre>
              </div>
            )
          case 'ul':
            return (
              <ul key={idx} className="list-disc list-inside space-y-1.5 pl-3 text-slate-300 text-xs leading-relaxed my-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="pl-1"
                    dangerouslySetInnerHTML={{ __html: parseInline(item) }}
                  />
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={idx} className="list-decimal list-inside space-y-1.5 pl-3 text-slate-300 text-xs leading-relaxed my-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="pl-1"
                    dangerouslySetInnerHTML={{ __html: parseInline(item) }}
                  />
                ))}
              </ol>
            )
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="border-l-3 border-indigo-500/40 bg-indigo-950/10 pl-4 py-2 pr-3 rounded-r-xl my-3 text-xs text-slate-300 italic leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
          case 'hr':
            return (
              <hr key={idx} className="border-slate-800/60 my-4" />
            )
          case 'table':
            return (
              <div key={idx} className="overflow-x-auto my-3 rounded-xl border border-slate-800/60">
                <table className="w-full text-xs text-slate-300">
                  <thead>
                    <tr className="bg-slate-950/60">
                      {block.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className="px-3 py-2 text-left font-bold text-slate-200 border-b border-slate-800/60 uppercase tracking-wider text-[10px]"
                          dangerouslySetInnerHTML={{ __html: parseInline(h) }}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-800/30 hover:bg-slate-900/40 transition-colors">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-2"
                            dangerouslySetInnerHTML={{ __html: parseInline(cell) }}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'p':
          default:
            return (
              <p
                key={idx}
                className="text-xs text-slate-300 leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: parseInline(block.text) }}
              />
            )
        }
      })}
    </div>
  )
}
