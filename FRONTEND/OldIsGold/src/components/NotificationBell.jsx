import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../context/useAuth'
import { notificationApi } from '../services/api'

const notificationTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function NotificationBell() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!token) {
      setNotifications([])
      setUnreadCount(0)
      return undefined
    }

    let active = true
    Promise.all([notificationApi.list(token, 1, 8), notificationApi.unreadCount(token)])
      .then(([listData, countData]) => {
        if (!active) return
        setNotifications(listData.notifications || [])
        setUnreadCount(countData.count || 0)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'
    const socket = io(socketUrl, { auth: { token } })
    socket.on('notification', (payload) => {
      const notification = payload?.notification
      if (!notification) return
      setNotifications((current) => [notification, ...current.filter((item) => item._id !== notification._id)].slice(0, 8))
      if (!notification.isRead) setUnreadCount((current) => current + 1)
    })

    const refreshUnreadCount = () => {
      notificationApi.unreadCount(token)
        .then((data) => setUnreadCount(data.count || 0))
        .catch((requestError) => setError(requestError.message))
    }
    window.addEventListener('campusmart:notifications-refresh', refreshUnreadCount)

    return () => {
      active = false
      window.removeEventListener('campusmart:notifications-refresh', refreshUnreadCount)
      socket.disconnect()
    }
  }, [token])

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const openNotification = async (notification) => {
    setError('')
    try {
      if (!notification.isRead) {
        await notificationApi.markRead(token, notification._id)
        setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true } : item))
        setUnreadCount((current) => Math.max(0, current - 1))
      }

      setOpen(false)
      const conversationId = notification.conversation?._id || notification.conversation
      const productId = notification.product?._id || notification.product
      const exchangeId = notification.campusExchange?._id || notification.campusExchange
      if (conversationId) navigate(`/messages/${conversationId}`)
      else if (productId) navigate(`/products/${productId}`)
      else if (exchangeId) navigate(`/campus-exchange/${exchangeId}`)
      else navigate('/notifications')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!user || !token) return null

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        className="notification-bell"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={async () => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (!nextOpen) return
          setLoading(true)
          setError('')
          try {
            const [listData, countData] = await Promise.all([notificationApi.list(token, 1, 8), notificationApi.unreadCount(token)])
            setNotifications(listData.notifications || [])
            setUnreadCount(countData.count || 0)
          } catch (requestError) {
            setError(requestError.message)
          } finally {
            setLoading(false)
          }
        }}
      >
        <span className="notification-bell-icon" aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown-heading">
            <strong>Notifications</strong>
            <button type="button" className="notification-view-all" onClick={() => { setOpen(false); navigate('/notifications') }}>View all</button>
          </div>
          {error && <p className="notification-inline-error" role="alert">{error}</p>}
          {loading ? <p className="notification-empty">Loading notifications...</p>
            : notifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p>
              : <div className="notification-dropdown-list">
                {notifications.map((notification) => (
                  <button
                    key={notification._id}
                    type="button"
                    className={`notification-preview${notification.isRead ? '' : ' is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-preview-title">{notification.title}</span>
                    <span className="notification-preview-message">{notification.message}</span>
                    <time>{notificationTime(notification.createdAt)}</time>
                  </button>
                ))}
              </div>}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
