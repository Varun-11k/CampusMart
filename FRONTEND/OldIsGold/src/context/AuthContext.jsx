import { useEffect, useState } from 'react'
import { authApi } from '../services/api'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('campusmart_token'))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('campusmart_user'))
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) return

    let active = true
    authApi.me(token).then((data) => {
      if (!active) return
      setUser(data.user)
      localStorage.setItem('campusmart_user', JSON.stringify(data.user))
    }).catch((error) => {
      if (!active || error.status !== 401) return
      localStorage.removeItem('campusmart_token')
      localStorage.removeItem('campusmart_user')
      setToken(null)
      setUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [token])

  const authenticate = async (method, payload) => {
    const data = await authApi[method](payload)
    localStorage.setItem('campusmart_token', data.token)
    localStorage.setItem('campusmart_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('campusmart_token')
    localStorage.removeItem('campusmart_user')
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, token, loading, login: (payload) => authenticate('login', payload), register: (payload) => authenticate('register', payload), logout }}>{children}</AuthContext.Provider>
}

