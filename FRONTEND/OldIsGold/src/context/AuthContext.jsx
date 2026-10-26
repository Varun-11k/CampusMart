import { useEffect, useState } from 'react'
import { authApi, authSecurityApi } from '../services/api'
import { AuthContext } from './authContext'

const TOKEN_KEY = 'campusmart_token'
const USER_KEY = 'campusmart_user'

function migrateLegacyRememberedSession() {
  try {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      const legacyToken = localStorage.getItem(TOKEN_KEY)
      if (legacyToken) sessionStorage.setItem(TOKEN_KEY, legacyToken)
    }
    if (!sessionStorage.getItem(USER_KEY)) {
      const legacyUser = localStorage.getItem(USER_KEY)
      if (legacyUser) sessionStorage.setItem(USER_KEY, legacyUser)
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Continue with in-memory authentication if browser storage is unavailable.
  }
}

migrateLegacyRememberedSession()

function readSessionValue(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readSessionValue(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(readSessionValue(USER_KEY))
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(Boolean(token))

  const clearSession = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch { /* Storage may be disabled; in-memory state is still cleared. */ }
  }

  const writeSession = (data) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, data.token)
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user))
    } catch { /* Keep this sign-in in memory if browser storage is unavailable. */ }
  }

  useEffect(() => {
    if (!token) return

    let active = true
    authApi.me(token).then((data) => {
      if (!active) return
      setUser(data.user)
      try { sessionStorage.setItem(USER_KEY, JSON.stringify(data.user)) } catch { /* Keep the account in memory. */ }
    }).catch((error) => {
      if (!active || error.status !== 401) return
      clearSession()
      setToken(null)
      setUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [token])

  const storeAuth = (data) => {
    clearSession()
    writeSession(data)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  const login = async (payload) => (await storeAuth(await authApi.login(payload))).user
  const register = async (payload) => {
    const data = await authApi.register(payload)
    storeAuth(data)
    return data
  }
  const googleLogin = async (credential, college) => (await storeAuth(await authSecurityApi.google(credential, college))).user
  const updateAuthenticatedUser = (data) => storeAuth(data)
  const updateCurrentUser = (nextUser) => {
    try { sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser)) } catch { /* Keep the account in memory. */ }
    setUser(nextUser)
  }

  const logout = async () => {
    const currentToken = token
    clearSession()
    setToken(null)
    setUser(null)
    if (!currentToken) return true
    try {
      await authSecurityApi.logout(currentToken)
      return true
    } catch {
      return false
    }
  }

  return <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, updateAuthenticatedUser, updateCurrentUser, logout }}>{children}</AuthContext.Provider>
}
