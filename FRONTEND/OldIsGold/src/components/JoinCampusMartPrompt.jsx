import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './JoinCampusMartPrompt.css'

const accountRoutes = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'])

function JoinCampusMartPrompt() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const visitStartedAt = useRef(Date.now())
  const wasSignedIn = useRef(Boolean(user))
  const joinLinkRef = useRef(null)

  useEffect(() => {
    if (user) {
      setOpen(false)
      visitStartedAt.current = Date.now()
      wasSignedIn.current = true
      return
    }

    if (loading || dismissed) return

    if (wasSignedIn.current) {
      visitStartedAt.current = Date.now()
      wasSignedIn.current = false
    }

    if (accountRoutes.has(location.pathname)) {
      setOpen(false)
      setDismissed(true)
      return
    }

    const delay = Math.max(0, 5000 - (Date.now() - visitStartedAt.current))
    const timer = window.setTimeout(() => setOpen(true), delay)
    return () => window.clearTimeout(timer)
  }, [dismissed, loading, location.pathname, user])

  useEffect(() => {
    if (!open) return undefined
    joinLinkRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDismissed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open || user) return null

  const dismiss = () => {
    setOpen(false)
    setDismissed(true)
  }

  return (
    <div
      className="join-prompt-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <section className="join-prompt-card" role="dialog" aria-modal="true" aria-labelledby="join-prompt-title" aria-describedby="join-prompt-copy">
        <button className="join-prompt-close" type="button" onClick={dismiss} aria-label="Close join prompt">&times;</button>
        <div className="join-prompt-mark" aria-hidden="true">C</div>
        <p className="join-prompt-eyebrow">Your campus, all in one place</p>
        <h2 id="join-prompt-title">Join CampusMart</h2>
        <p id="join-prompt-copy">Buy and sell with students, find lost items, share resources, and keep up with campus life.</p>
        <div className="join-prompt-actions">
          <Link ref={joinLinkRef} className="primary-button" to="/register" onClick={dismiss}>Create your account</Link>
          <button className="secondary-button" type="button" onClick={dismiss}>Maybe later</button>
        </div>
        <p className="join-prompt-login">Already have an account? <Link to="/login" onClick={dismiss}>Log in</Link></p>
      </section>
    </div>
  )
}

export default JoinCampusMartPrompt
