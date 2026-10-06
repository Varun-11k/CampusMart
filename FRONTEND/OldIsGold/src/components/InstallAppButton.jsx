import { useEffect, useState } from 'react'

const DISMISSAL_KEY = 'campusmart-install-dismissed'

function isStandaloneMode() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function wasDismissed() {
    try {
        return window.sessionStorage.getItem(DISMISSAL_KEY) === 'true'
    } catch {
        return false
    }
}

function markDismissed() {
    try {
        window.sessionStorage.setItem(DISMISSAL_KEY, 'true')
    } catch {
        // The button still stays hidden for this render if session storage is unavailable.
    }
}

function InstallAppButton() {
    const [installPrompt, setInstallPrompt] = useState(null)
    const [hidden, setHidden] = useState(() => isStandaloneMode() || wasDismissed())

    useEffect(() => {
        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault()
            if (isStandaloneMode() || wasDismissed()) return
            setInstallPrompt(event)
            setHidden(false)
        }

        const handleAppInstalled = () => {
            setInstallPrompt(null)
            setHidden(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
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
            setHidden(true)
        }
    }

    if (hidden || !installPrompt) return null

    return (
        <button className="install-app-button" type="button" onClick={installApp}>
            📱 Install CampusMart App
        </button>
    )
}

export default InstallAppButton