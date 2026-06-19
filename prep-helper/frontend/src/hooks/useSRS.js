import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function useSRS() {
  const [session, setSession] = useState(null)
  const [currentCard, setCurrentCard] = useState(null)
  const [queuedCards, setQueuedCards] = useState([])
  const [reviewedCount, setReviewedCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)

  // Tracking rating breakdown for session end summaries
  const [ratingBreakdown, setRatingBreakdown] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  })

  // Start study session
  const startSession = async (tagFilter = null, studyAhead = false) => {
    setLoading(true)
    setIsComplete(false)
    setReviewedCount(0)
    setRatingBreakdown({ again: 0, hard: 0, good: 0, easy: 0 })
    
    try {
      // 1. Log session start in backend
      const sessionRes = await api.post('/srs/session/start', {
        tag_filter: tagFilter,
        session_type: 'flashcard'
      })
      
      const newSession = sessionRes.data
      setSession(newSession)

      // 2. Load due cards list from backend
      // If studyAhead is true, we fetch more questions regardless of due date by accessing question list
      let cards = []
      if (studyAhead) {
        // Fetch questions matching tagFilter, limit to 20 for custom study
        const qRes = await api.get('/questions', {
          params: {
            tags: tagFilter,
            limit: 20
          }
        })
        cards = qRes.data?.data || []
      } else {
        // Fetch standard due cards
        const dueRes = await api.get('/srs/due', {
          params: {
            tags: tagFilter,
            limit: 30
          }
        })
        cards = dueRes.data || []
      }

      if (cards.length > 0) {
        setCurrentCard(cards[0])
        setQueuedCards(cards.slice(1))
      } else {
        setCurrentCard(null)
        setQueuedCards([])
        setIsComplete(true)
        
        // Auto-end session immediately since there is no cards
        if (newSession?.session_id) {
          await api.post(`/srs/session/${newSession.session_id}/end`, null, {
            params: { cards_reviewed: 0 }
          })
        }
      }
    } catch (err) {
      console.error('Failed to start study session:', err)
      toast.error('Could not load flashcard study deck.')
    } finally {
      setLoading(false)
    }
  }

  // Submit recall rating
  const submitRating = async (rating) => {
    if (!currentCard || !session) return

    setSubmittingRating(true)
    try {
      // 1. Submit review to backend to update SM-2 schedule
      const res = await api.post('/srs/review', {
        question_id: currentCard.id,
        rating: rating
      })

      // Show small toast with interval info
      if (res.data) {
        const interval = res.data.interval_days
        const text = interval === 1 ? '1 day' : `${interval} days`
        toast.success(`Scheduled for review in ${text}.`, { id: 'srs-schedule-toast' })
      }

      // Update counters
      setReviewedCount(prev => prev + 1)
      setRatingBreakdown(prev => ({
        ...prev,
        [rating]: prev[rating] + 1
      }))

      // Handle card queue progression
      const nextQueue = [...queuedCards]
      
      // Traditional SRS practice: if card was rated 'again', append it to the end of the session queue
      if (rating === 'again') {
        nextQueue.push(currentCard)
      }

      if (nextQueue.length > 0) {
        setCurrentCard(nextQueue[0])
        setQueuedCards(nextQueue.slice(1))
      } else {
        // Completed session
        setCurrentCard(null)
        setIsComplete(true)
        await endSession(reviewedCount + 1)
      }
    } catch (err) {
      console.error('Failed to log card rating:', err)
    } finally {
      setSubmittingRating(false)
    }
  }

  // End study session
  const endSession = async (totalReviewed = reviewedCount) => {
    if (!session) return
    try {
      await api.post(`/srs/session/${session.session_id}/end`, null, {
        params: { cards_reviewed: totalReviewed }
      })
    } catch (err) {
      console.error('Failed to end study session:', err)
    }
  }

  return {
    session,
    currentCard,
    queuedCards,
    reviewedCount,
    isComplete,
    loading,
    submittingRating,
    ratingBreakdown,
    startSession,
    submitRating,
    endSession
  }
}
