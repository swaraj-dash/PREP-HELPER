import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Trash2, RefreshCw, Layers, ArrowRight, Loader, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import api from '../api/client'

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [reprocessingIds, setReprocessingIds] = useState(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const fetchDocuments = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await api.get('/documents')
      if (res.data) {
        setDocuments(res.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Load documents on mount
  useEffect(() => {
    fetchDocuments(true)
  }, [])

  // Auto-polling when documents are processing (every 5 seconds)
  useEffect(() => {
    const hasActiveProcessing = documents.some(
      (doc) => !['done', 'error'].includes(doc.status)
    )

    if (!hasActiveProcessing) return

    const interval = setInterval(() => {
      fetchDocuments(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [documents])

  const handleReprocess = async (id) => {
    setReprocessingIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })

    try {
      const res = await api.post(`/documents/${id}/reprocess`)
      if (res.data) {
        toast.success('Document reprocessing scheduled!')
        fetchDocuments(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to trigger reprocessing.')
    } finally {
      setReprocessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/documents/${id}?confirm=true`)
      if (res.data) {
        toast.success('Document deleted successfully.')
        setDeleteConfirmId(null)
        fetchDocuments(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete document.')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 w-fit">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Ready</span>
          </span>
        )
      case 'error':
        return (
          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 w-fit">
            <XCircle className="h-3.5 w-3.5" />
            <span>Failed</span>
          </span>
        )
      case 'queued':
        return (
          <span className="bg-slate-800 text-slate-400 border border-slate-700/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 w-fit">
            <Clock className="h-3.5 w-3.5" />
            <span>Queued</span>
          </span>
        )
      default:
        // extracting, classifying, chunking, tagging, embedding
        return (
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 w-fit animate-pulse">
            <Loader className="h-3.5 w-3.5 animate-spin" />
            <span className="capitalize">{status}</span>
          </span>
        )
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Documents</h1>
          <p className="text-slate-400 mt-1">Manage uploaded content libraries, track extraction runs, and check metrics.</p>
        </div>
        <Link
          to="/upload"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-2 text-sm"
        >
          <span>Upload PDF</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading documents library...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="glow-card border border-slate-800 rounded-3xl p-16 text-center max-w-xl mx-auto space-y-6">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Layers className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">No documents uploaded yet</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Once you upload PDF guides, slide decks, or cheatsheets, they will appear here with automated concept tag counters.
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/10 text-sm"
          >
            Upload First Document
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/20">
                  <th className="px-6 py-4">Document Details</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Questions</th>
                  <th className="px-6 py-4 text-center">Notes</th>
                  <th className="px-6 py-4">Concept Tags</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => {
                  const tags = doc.tag_summary || []
                  const isReprocessing = reprocessingIds.has(doc.id)

                  return (
                    <tr key={doc.id} className="hover:bg-slate-900/20 transition-colors">
                      {/* Name & Type */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-200 truncate max-w-xs" title={doc.original_name}>
                          {doc.original_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1 flex items-center space-x-2">
                          <span>{doc.file_type}</span>
                          <span>•</span>
                          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {doc.error_message && (
                          <div className="text-rose-400 text-xs mt-1.5 flex items-center space-x-1 max-w-xs truncate" title={doc.error_message}>
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{doc.error_message}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* Q&A Counts */}
                      <td className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                        {doc.status === 'done' ? doc.question_count : '-'}
                      </td>

                      {/* Note Counts */}
                      <td className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                        {doc.status === 'done' ? doc.note_count : '-'}
                      </td>

                      {/* Tags Preview */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {doc.status === 'done' && tags.length > 0 ? (
                            tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))
                          ) : doc.status === 'done' ? (
                            <span className="text-xs text-slate-600 italic">No tags</span>
                          ) : (
                            <span className="text-xs text-slate-600 italic">Processing...</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Reprocess Button */}
                          {(doc.status === 'error' || doc.status === 'done') && (
                            <button
                              onClick={() => handleReprocess(doc.id)}
                              disabled={isReprocessing}
                              title="Reprocess Document"
                              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          
                          {/* Delete Trigger */}
                          <button
                            onClick={() => setDeleteConfirmId(doc.id)}
                            title="Delete Document"
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 text-center shadow-2xl animate-scaleIn">
            <div className="h-12 w-12 mx-auto rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Trash2 className="h-6 w-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Delete Document?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                This action is permanent. All extracted question cards, study note chunks, tag relations, and learning history will be deleted.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 py-3 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/15"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
