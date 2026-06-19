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


export default api
