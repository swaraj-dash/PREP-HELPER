import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor to intercept errors and show toast messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred.'
    if (error.response && error.response.data) {
      const data = error.response.data
      if (data.error && data.error.message) {
        message = data.error.message
      } else if (data.detail) {
        message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      }
    }
    toast.error(message)
    return Promise.reject(error)
  }
)

export const getSettings = () => api.get('/settings')
export const saveSettings = (data) => api.post('/settings', data)
export const testApiKey = (data) => api.post('/settings/test-key', data)
export const setupVault = (vault_path) => api.post('/vault/setup', { vault_path })
export const getHealth = () => api.get('/health')
export const suggestQuestionMetadata = (data) => api.post('/questions/suggest-metadata', data)

// Notes
export const getNotes = (params) => api.get('/notes', { params })
export const getNotesByTopic = (topicName) => api.get(`/notes/topic/${encodeURIComponent(topicName)}`)
export const patchNote = (id, data) => api.patch(`/notes/${id}`, data)

// Annotations
export const createAnnotation = (data) => api.post('/annotations', data)
export const getAnnotations = (itemType, itemId) => api.get(`/annotations/${itemType}/${itemId}`)
export const updateAnnotation = (id, data) => api.put(`/annotations/${id}`, data)
export const deleteAnnotation = (id) => api.delete(`/annotations/${id}`)

// Tags
export const getTags = (params) => api.get('/tags', { params })
export const createTag = (data) => api.post('/tags', data)
export const patchTag = (id, data) => api.patch(`/tags/${id}`, data)
export const mergeTags = (data) => api.post('/tags/merge', data)
export const deleteTag = (id, force = false) => api.delete(`/tags/${id}`, { params: { force } })

// Vault Export/Import
export const exportVault = (data) => api.post('/vault/export', data)
export const previewVault = (filePath) => api.post('/vault/import/preview', { file_path: filePath })
export const importVault = (data) => api.post('/vault/import', data)

export default api

