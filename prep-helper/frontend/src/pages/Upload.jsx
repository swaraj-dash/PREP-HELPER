import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { UploadCloud, File, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import api from '../api/client'
import { usePipeline } from '../hooks/usePipeline'
import PipelineProgress from '../components/PipelineProgress'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docId, setDocId] = useState(null)

  const pipeline = usePipeline()

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      // Reset pipeline state
      setDocId(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
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

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data && res.data.doc_id) {
        const id = res.data.doc_id
        setDocId(id)
        toast.success('File uploaded successfully! Starting extraction pipeline...')
        // Connect websocket
        pipeline.connect(id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload document.')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setDocId(null)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 relative">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Upload Documents</h1>
        <p className="text-slate-400 mt-1">Injest tech guides, cheatsheets, or question lists to extract Q&As and Study Notes.</p>
      </div>

      {!docId ? (
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
                  {isDragActive ? 'Drop your document here' : 'Drag & drop file here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  or click to select file from device
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

          {/* Selected File Details */}
          {file && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60 text-indigo-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-2 disabled:bg-indigo-800"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload & Ingest</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <PipelineProgress {...pipeline} />
          
          {(pipeline.isComplete || pipeline.isError) && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleReset}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold px-6 py-3 rounded-xl transition-all flex items-center space-x-2"
              >
                <span>Upload Another File</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
