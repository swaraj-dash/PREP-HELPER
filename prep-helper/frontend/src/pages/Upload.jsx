import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { UploadCloud, File, AlertCircle, RefreshCw, FileText, Plus, X, CheckCircle, Clock, Loader } from 'lucide-react'
import api from '../api/client'
import { usePipeline } from '../hooks/usePipeline'
import PipelineProgress from '../components/PipelineProgress'

// File status constants
const STATUS = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
}

export default function Upload() {
  const [fileQueue, setFileQueue] = useState([]) // Array of { id, file, status, error? }
  const [activeIndex, setActiveIndex] = useState(-1) // Index of currently processing file
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)

  const pipeline = usePipeline()

  // Add files to queue
  const addFilesToQueue = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const newEntries = acceptedFiles.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        status: STATUS.QUEUED,
        error: null,
      }))
      setFileQueue((prev) => [...prev, ...newEntries])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFilesToQueue,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    }
  })

  // Remove a queued file
  const removeFromQueue = (id) => {
    setFileQueue((prev) => prev.filter((f) => f.id !== id))
  }

  // Update file status in queue
  const updateFileStatus = (id, status, error = null) => {
    setFileQueue((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, error } : f))
    )
  }

  // Process a single file: upload -> wait for pipeline completion
  const processFile = async (entry) => {
    updateFileStatus(entry.id, STATUS.UPLOADING)
    
    const formData = new FormData()
    formData.append('file', entry.file)

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.data && res.data.doc_id) {
        updateFileStatus(entry.id, STATUS.PROCESSING)
        const docId = res.data.doc_id

        // Connect pipeline WebSocket and wait for completion
        return new Promise((resolve) => {
          pipeline.connect(docId, entry.file.name)

          // Poll pipeline state to detect completion
          const checkInterval = setInterval(() => {
            // Access latest state via the pipeline ref
          }, 500)

          // We'll use a message listener approach instead
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const wsUrl = `${wsProtocol}//${window.location.host}/ws/pipeline/${docId}`
          const monitorWs = new WebSocket(wsUrl)

          monitorWs.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              if (data.stage === 'done') {
                updateFileStatus(entry.id, STATUS.DONE)
                monitorWs.close()
                clearInterval(checkInterval)
                resolve({ success: true })
              } else if (data.stage === 'error') {
                updateFileStatus(entry.id, STATUS.ERROR, data.message || 'Processing failed')
                monitorWs.close()
                clearInterval(checkInterval)
                resolve({ success: false })
              }
            } catch (e) {
              // ignore parse errors
            }
          }

          monitorWs.onerror = () => {
            updateFileStatus(entry.id, STATUS.ERROR, 'WebSocket connection failed')
            clearInterval(checkInterval)
            resolve({ success: false })
          }

          // Timeout after 10 minutes
          setTimeout(() => {
            if (monitorWs.readyState === WebSocket.OPEN) {
              monitorWs.close()
            }
            clearInterval(checkInterval)
            resolve({ success: false })
          }, 600000)
        })
      }
    } catch (err) {
      console.error(err)
      updateFileStatus(entry.id, STATUS.ERROR, 'Upload failed')
      return { success: false }
    }
  }

  // Start sequential processing of all queued files
  const startProcessing = async () => {
    const queuedFiles = fileQueue.filter((f) => f.status === STATUS.QUEUED)
    if (queuedFiles.length === 0) {
      toast.error('No files in queue.')
      return
    }

    setIsProcessing(true)

    for (let i = 0; i < fileQueue.length; i++) {
      const entry = fileQueue[i]
      if (entry.status !== STATUS.QUEUED) continue

      setActiveIndex(i)
      await processFile(entry)
    }

    setIsProcessing(false)
    setActiveIndex(-1)
    toast.success('All files in queue have been processed!')
  }

  // Handle + button to open file picker
  const handleAddMore = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleManualFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    addFilesToQueue(files)
    e.target.value = '' // Reset input
  }

  const handleReset = () => {
    setFileQueue([])
    setActiveIndex(-1)
    setIsProcessing(false)
  }

  const queuedCount = fileQueue.filter((f) => f.status === STATUS.QUEUED).length
  const doneCount = fileQueue.filter((f) => f.status === STATUS.DONE).length
  const errorCount = fileQueue.filter((f) => f.status === STATUS.ERROR).length

  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.QUEUED:
        return <Clock className="h-4 w-4 text-slate-500" />
      case STATUS.UPLOADING:
        return <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
      case STATUS.PROCESSING:
        return <Loader className="h-4 w-4 text-indigo-400 animate-spin" />
      case STATUS.DONE:
        return <CheckCircle className="h-4 w-4 text-emerald-400" />
      case STATUS.ERROR:
        return <AlertCircle className="h-4 w-4 text-rose-400" />
      default:
        return <Clock className="h-4 w-4 text-slate-500" />
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      [STATUS.QUEUED]: 'bg-slate-900 text-slate-400 border-slate-800',
      [STATUS.UPLOADING]: 'bg-amber-950/60 text-amber-400 border-amber-500/20',
      [STATUS.PROCESSING]: 'bg-indigo-950/60 text-indigo-400 border-indigo-500/20 animate-pulse',
      [STATUS.DONE]: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/20',
      [STATUS.ERROR]: 'bg-rose-950/60 text-rose-400 border-rose-500/20',
    }
    const labels = {
      [STATUS.QUEUED]: 'Queued',
      [STATUS.UPLOADING]: 'Uploading...',
      [STATUS.PROCESSING]: 'Processing...',
      [STATUS.DONE]: 'Complete',
      [STATUS.ERROR]: 'Failed',
    }
    return (
      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 relative">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Upload Documents</h1>
        <p className="text-slate-400 mt-1">Ingest tech guides, cheatsheets, or question lists to extract Q&As and Study Notes.</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Drag & Drop Zone */}
        <div
          {...getRootProps()}
          className={`glow-card border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/5'
              : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4 relative z-10 flex flex-col items-center">
            <div className={`p-4 rounded-2xl border transition-colors duration-300 ${
              isDragActive ? 'bg-indigo-950 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <UploadCloud className="h-10 w-10 animate-bounce" />
            </div>
            <div>
              <p className="text-base font-bold text-white tracking-tight">
                {isDragActive ? 'Drop your documents here' : 'Drag & drop files here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                or click to select — you can add multiple files
              </p>
            </div>
            <div className="pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex flex-wrap gap-2 justify-center">
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">PDF</span>
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">DOCX</span>
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">PPTX</span>
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">TXT</span>
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">MD</span>
              <span className="bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/40">IMAGES</span>
            </div>
          </div>
        </div>

        {/* File Queue */}
        {fileQueue.length > 0 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Queue Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Upload Queue
                </h3>
                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                  {fileQueue.length} file{fileQueue.length > 1 ? 's' : ''}
                </span>
                {doneCount > 0 && (
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    {doneCount} done
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950/60 border border-rose-500/20 px-2 py-0.5 rounded-md">
                    {errorCount} failed
                  </span>
                )}
              </div>

              {/* + Add More Button */}
              <button
                onClick={handleAddMore}
                disabled={isProcessing}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 p-2 rounded-xl transition-all disabled:opacity-40"
                title="Add more files"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleManualFileSelect}
                accept=".pdf,.docx,.doc,.pptx,.txt,.md,.png,.jpg,.jpeg"
              />
            </div>

            {/* File List */}
            <div className="space-y-2">
              {fileQueue.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`bg-slate-900/60 border rounded-2xl p-4 flex items-center justify-between transition-all duration-300 ${
                    activeIndex === idx
                      ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                      : entry.status === STATUS.DONE
                      ? 'border-emerald-500/20'
                      : entry.status === STATUS.ERROR
                      ? 'border-rose-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/60 text-indigo-400 flex-shrink-0">
                      {getStatusIcon(entry.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{entry.file.name}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="text-xs text-slate-400">{(entry.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        {entry.error && (
                          <p className="text-xs text-rose-400 truncate max-w-[200px]">{entry.error}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {getStatusBadge(entry.status)}
                    {entry.status === STATUS.QUEUED && !isProcessing && (
                      <button
                        onClick={() => removeFromQueue(entry.id)}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                        title="Remove from queue"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-3 pt-2">
              {queuedCount > 0 && !isProcessing && (
                <button
                  onClick={startProcessing}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-2"
                >
                  <UploadCloud className="h-5 w-5" />
                  <span>Upload & Ingest {queuedCount > 1 ? `All ${queuedCount} Files` : 'File'}</span>
                </button>
              )}
              {!isProcessing && doneCount + errorCount === fileQueue.length && fileQueue.length > 0 && (
                <button
                  onClick={handleReset}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold px-6 py-3 rounded-xl transition-all flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Clear Queue & Start Fresh</span>
                </button>
              )}
              {isProcessing && (
                <div className="flex items-center space-x-2 text-indigo-400 text-sm font-bold">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Processing queue... ({doneCount + errorCount}/{fileQueue.length})</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Pipeline Progress (shows for current file) */}
        {isProcessing && activeIndex >= 0 && (
          <div className="animate-fadeIn">
            <PipelineProgress {...pipeline} />
          </div>
        )}
      </div>
    </div>
  )
}
