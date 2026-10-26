import { useEffect, useRef, useState } from 'react'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleScriptUrl = 'https://accounts.google.com/gsi/client'

function GoogleSignInButton({ onCredential, disabled = false }) {
  const buttonRef = useRef(null)
  const callbackRef = useRef(onCredential)
  const disabledRef = useRef(disabled)
  const [ready, setReady] = useState(Boolean(window.google?.accounts?.id))
  const [scriptError, setScriptError] = useState(false)

  useEffect(() => {
    callbackRef.current = onCredential
    disabledRef.current = disabled
  }, [disabled, onCredential])

  useEffect(() => {
    if (!clientId) return undefined
    let active = true
    let script = document.querySelector(`script[src="${googleScriptUrl}"]`)

    const renderGoogleButton = () => {
      if (!active || !buttonRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!disabledRef.current && response.credential) callbackRef.current(response.credential)
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(360, Math.max(240, buttonRef.current.clientWidth)),
      })
      setReady(true)
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton()
      return () => { active = false }
    }

    const handleLoad = () => renderGoogleButton()
    const handleError = () => { if (active) setScriptError(true) }

    if (!script) {
      script = document.createElement('script')
      script.src = googleScriptUrl
      script.async = true
      script.defer = true
      script.onload = handleLoad
      script.onerror = handleError
      document.head.append(script)
    } else {
      script.addEventListener('load', handleLoad)
      script.addEventListener('error', handleError)
    }

    if (window.google?.accounts?.id) handleLoad()
    return () => {
      active = false
      script?.removeEventListener('load', handleLoad)
      script?.removeEventListener('error', handleError)
    }
  }, [])

  if (!clientId) return <p className="auth-provider-note">Google sign-in is not configured for this deployment.</p>

  return <div className={`google-signin${disabled ? ' is-disabled' : ''}`} aria-busy={!ready && !scriptError}>
    {!ready && !scriptError && <span className="google-signin-status">Loading Google sign-in…</span>}
    {scriptError && <span className="google-signin-status" role="status">Google sign-in could not load. Check your connection or use email.</span>}
    <div ref={buttonRef} aria-hidden={disabled || scriptError} />
    {disabled && <span className="google-signin-disabled" aria-live="polite">Please wait…</span>}
  </div>
}

export default GoogleSignInButton
