import { useEffect, useState } from 'react'

const DISMISSAL_KEY = 'campusmart-install-dismissed'

function isStandaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function wasDismissed() {
  try { return window.sessionStorage.getItem(DISMISSAL_KEY) === 'true' } catch { return false }
}

function markDismissed() {
  try { window.sessionStorage.setItem(DISMISSAL_KEY, 'true') } catch { /* Ignore unavailable session storage. */ }
}

function installInstructions() {
  const userAgent = window.navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)) {
    return 'In Safari, open Share and choose Add to Home Screen.'
  }
  return 'Open your browser menu and choose Install CampusMart or Add to Home Screen, if offered.'
}

function PwaInstallControl() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [hidden, setHidden] = useState(() => isStandaloneMode() || wasDismissed())
  const [installError, setInstallError] = useState('')
  const [installNotice, setInstallNotice] = useState('')

  useEffect(() => {
    let noticeTimer
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      if (isStandaloneMode() || wasDismissed()) return
      setInstallPrompt(event)
      setInstallError('')
      setHidden(false)
    }
    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setHidden(true)
      setInstallNotice('CampusMart is installed. Open it from your home screen or apps.')
      noticeTimer = window.setTimeout(() => setInstallNotice(''), 6000)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.clearTimeout(noticeTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'dismissed') markDismissed()
      setInstallPrompt(null)
      setHidden(true)
    } catch {
      setInstallPrompt(null)
      setInstallError('The install prompt was unavailable. Use the browser menu to install CampusMart if supported.')
    }
  }

  if (hidden && !installNotice) return null
  return <div className="install-app-area">
    {installNotice
      ? <span className="install-app-success" role="status">{installNotice}</span>
      : installPrompt
      ? <button className="install-app-button" type="button" onClick={installApp}>Install CampusMart</button>
      : <details className="install-guidance"><summary>How to install</summary><p>{installInstructions()}</p></details>}
    {installError && <span className="install-app-error" role="status">{installError}</span>}
  </div>
}

export default PwaInstallControl
