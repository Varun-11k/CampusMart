import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { wishlistApi } from '../services/api'

export function useWishlist() {
  const { token } = useAuth()
  const [savedIds, setSavedIds] = useState([])
  const [pendingIds, setPendingIds] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setSavedIds([])
      setLoading(false)
      return undefined
    }

    let active = true
    setLoading(true)
    setError('')

    wishlistApi.list(token)
      .then((data) => {
        if (active) setSavedIds((data.products || []).map((product) => product._id))
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  const toggleSaved = async (productId) => {
    if (!token || pendingIds.includes(productId)) return false

    const wasSaved = savedIds.includes(productId)
    setError('')
    setPendingIds((current) => [...current, productId])

    try {
      if (wasSaved) {
        await wishlistApi.remove(token, productId)
        setSavedIds((current) => current.filter((id) => id !== productId))
      } else {
        await wishlistApi.add(token, productId)
        setSavedIds((current) => current.includes(productId) ? current : [...current, productId])
      }
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setPendingIds((current) => current.filter((id) => id !== productId))
    }
  }

  return { savedIds, pendingIds, loading, error, toggleSaved }
}
