import { useEffect, useState } from 'react'

function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    let restoredTimer
    const handleOffline = () => {
      window.clearTimeout(restoredTimer)
      setRestored(false)
      setOnline(false)
    }
    const handleOnline = () => {
      setOnline(true)
      setRestored(true)
      restoredTimer = window.setTimeout(() => setRestored(false), 6000)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.clearTimeout(restoredTimer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (online && !restored) return null
  return <div className={`network-status-banner${online ? ' is-online' : ''}`} role={online ? 'status' : 'alert'} aria-live="polite">
    {online ? 'You’re back online. Retry any request that did not finish.' : 'You’re offline. Requests are not saved; reconnect and retry.'}
  </div>
}

export default NetworkStatusBanner
