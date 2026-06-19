import { useState, useEffect, useRef, useCallback } from 'react'

export function usePipeline() {
  const [state, setState] = useState({
    stage: 'queued', // queued | extracting | classifying | chunking | tagging | embedding | done | error
    progress: 0,
    message: 'Waiting for upload...',
    details: {},
    isComplete: false,
    isError: false,
    errorMessage: '',
  })

  const socketRef = useRef(null)

  const connect = useCallback((docId) => {
    if (!docId) return

    // Close any existing connection
    if (socketRef.current) {
      socketRef.current.close()
    }

    // Determine WS protocol based on current HTTP protocol (handles localhost & SSL)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/pipeline/${docId}`

    const socket = new WebSocket(wsUrl)
    socketRef.current = socket

    setState({
      stage: 'queued',
      progress: 0,
      message: 'Connection established. Queuing document...',
      details: {},
      isComplete: false,
      isError: false,
      errorMessage: '',
    })

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        setState((prev) => {
          const isDone = data.stage === 'done'
          const isErr = data.stage === 'error'
          
          return {
            ...prev,
            stage: data.stage || prev.stage,
            progress: typeof data.progress === 'number' ? data.progress : prev.progress,
            message: data.message || prev.message,
            details: data.details || prev.details,
            isComplete: isDone,
            isError: isErr,
            errorMessage: isErr ? (data.message || 'An error occurred during processing.') : '',
          }
        })

        // Close socket if completed or errored
        if (data.stage === 'done' || data.stage === 'error') {
          socket.close()
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setState((prev) => ({
        ...prev,
        stage: 'error',
        isError: true,
        errorMessage: 'WebSocket connection failed.',
      }))
    }

    socket.onclose = (event) => {
      console.log('WebSocket connection closed.', event.reason)
    }
  }, [])

  // Auto-cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  return {
    ...state,
    connect,
  }
}
