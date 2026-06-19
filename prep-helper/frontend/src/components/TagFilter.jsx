import React, { useState, useEffect, useRef } from 'react'
import { X, Search, ChevronDown, Check } from 'lucide-react'
import api from '../api/client'
import { getTagClasses } from '../utils/tagColors'

export default function TagFilter({ selectedTags = [], onChange }) {
  const [tags, setTags] = useState([])
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // Fetch tags from API
    api.get('/tags')
      .then((res) => {
        if (res.data) {
          setTags(res.data)
        }
      })
      .catch((err) => {
        console.error('Failed to load tags for filter:', err)
      })
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredTags = tags.filter((t) => {
    const isAlreadySelected = selectedTags.includes(t.name)
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    return !isAlreadySelected && matchesSearch
  })

  const handleSelectTag = (tagName) => {
    const nextTags = [...selectedTags, tagName]
    onChange(nextTags)
    setSearch('')
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const handleRemoveTag = (tagName) => {
    const nextTags = selectedTags.filter((t) => t !== tagName)
    onChange(nextTags)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownOpen(true)
      setHighlightedIndex((prev) => 
        prev < filteredTags.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownOpen(true)
      setHighlightedIndex((prev) => 
        prev > 0 ? prev - 1 : filteredTags.length - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredTags.length) {
        handleSelectTag(filteredTags[highlightedIndex].name)
      } else if (search.trim() && !selectedTags.includes(search.trim())) {
        // Allow adding custom tags directly if they typed it
        // We find if it exists in tags array first (case insensitive)
        const match = tags.find((t) => t.name.toLowerCase() === search.trim().toLowerCase())
        handleSelectTag(match ? match.name : search.trim())
      }
    } else if (e.key === 'Backspace' && !search && selectedTags.length > 0) {
      // Remove last tag if backspace pressed on empty input
      handleRemoveTag(selectedTags[selectedTags.length - 1])
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="space-y-3 relative w-full text-left">
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
        Filter by Concept Tags
      </label>

      {/* Input container */}
      <div className="relative flex items-center bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-xl px-3.5 py-1.5 transition-colors">
        <Search className="h-4.5 w-4.5 text-slate-500 mr-2 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setDropdownOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length > 0 ? "Add tags..." : "Search concepts (e.g. RAG, React)..."}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 focus:outline-none py-1"
        />
        <ChevronDown 
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="h-4.5 w-4.5 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors flex-shrink-0" 
        />

        {/* Dropdown list */}
        {dropdownOpen && filteredTags.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-850 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-40 animate-slideDown">
            {filteredTags.map((tag, idx) => {
              const classes = getTagClasses(tag.tag_type)
              const isHighlighted = idx === highlightedIndex
              
              return (
                <div
                  key={tag.id}
                  onClick={() => handleSelectTag(tag.name)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                    isHighlighted ? 'bg-slate-800 text-white' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold">{tag.name}</span>
                    <span className={`text-[9px] uppercase tracking-wider scale-90 px-2 py-0.5 rounded-md border font-extrabold ${
                      tag.tag_type === 'tech' ? 'bg-blue-950 border-blue-800 text-blue-400' :
                      tag.tag_type === 'concept' ? 'bg-purple-950 border-purple-800 text-purple-400' :
                      tag.tag_type === 'domain' ? 'bg-emerald-950 border-emerald-800 text-emerald-400' :
                      tag.tag_type === 'custom' ? 'bg-pink-950 border-pink-800 text-pink-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}>
                      {tag.tag_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {tag.usage_count} {tag.usage_count === 1 ? 'item' : 'items'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected tags chips list */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 animate-fadeIn">
          {selectedTags.map((tagName) => {
            // Find tag type from loaded list or default to custom
            const matchedTag = tags.find((t) => t.name === tagName)
            const type = matchedTag ? matchedTag.tag_type : 'custom'
            
            return (
              <span
                key={tagName}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all duration-200 select-none ${
                  type === 'tech' ? 'bg-blue-950/40 border-blue-900/60 text-blue-400 hover:border-blue-700/80' :
                  type === 'concept' ? 'bg-purple-950/40 border-purple-900/60 text-purple-400 hover:border-purple-700/80' :
                  type === 'domain' ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400 hover:border-emerald-700/80' :
                  type === 'custom' ? 'bg-pink-950/40 border-pink-900/60 text-pink-400 hover:border-pink-700/80' :
                  'bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{tagName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tagName)}
                  className="hover:bg-slate-800/60 p-0.5 rounded-md transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
