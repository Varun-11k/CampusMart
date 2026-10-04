import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { notificationApi } from '../services/api'

const PAGE_SIZE = 30

const refreshNotificationBadge = () => {
  window.dispatchEvent(new Event('campusmart:notifications-refresh'))
}

const notificationTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Notifications() {
  const navigate = useNavigate()
  const { user, token, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (authLoading) return undefined
    if (!user || !token) {
      navigate('/login', { state: { from: '/notifications' }, replace: true })
      return undefined
    }

    let active = true
    setLoading(true)
    setError('')
    notificationApi.list(token, page, PAGE_SIZE)
      .then((data) => {
        if (!active) return
        setNotifications(data.notifications || [])
        setPages(data.pagination?.pages || 1)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [authLoading, navigate, page, token, user])

  const openNotification = async (notification) => {
    setError('')
    try {
      if (!notification.isRead) {
        await notificationApi.markRead(token, notification._id)
        setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true } : item))
        refreshNotificationBadge()
      }

      const conversationId = notification.conversation?._id || notification.conversation
      const productId = notification.product?._id || notification.product
      const exchangeId = notification.campusExchange?._id || notification.campusExchange
      if (conversationId) navigate(`/messages/${conversationId}`)
      else if (productId) navigate(`/products/${productId}`)
      else if (exchangeId) navigate(`/campus-exchange/${exchangeId}`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const markRead = async (notificationId) => {
    setPendingId(notificationId)
    setError('')
    try {
      await notificationApi.markRead(token, notificationId)
      setNotifications((current) => current.map((item) => item._id === notificationId ? { ...item, isRead: true } : item))
      refreshNotificationBadge()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPendingId('')
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    setError('')
    try {
      await notificationApi.markAllRead(token)
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      refreshNotificationBadge()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setMarkingAll(false)
    }
  }

  const deleteNotification = async (notificationId) => {
    setPendingId(notificationId)
    setError('')
    try {
      const wasUnread = notifications.some((notification) => notification._id === notificationId && !notification.isRead)
      await notificationApi.remove(token, notificationId)
      setNotifications((current) => current.filter((item) => item._id !== notificationId))
      if (wasUnread) refreshNotificationBadge()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPendingId('')
    }
  }

  if (authLoading || loading) {
    return <section className="placeholder"><strong>Loading notifications...</strong></section>
  }

  return (
    <section className="notifications-page">
      <div className="page-header-row">
        <div>
          <p className="eyebrow">Updates</p>
          <h1>Notifications</h1>
        </div>
        <button className="secondary-button" type="button" onClick={markAllRead} disabled={markingAll || !notifications.some((item) => !item.isRead)}>
          {markingAll ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {notifications.length === 0 && !error ? (
        <div className="empty-state">
          <strong>You have no notifications yet.</strong>
          <span>Updates about messages and saved products will appear here.</span>
          <Link className="primary-button" to="/marketplace">Browse marketplace</Link>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <article className={`notification-item${notification.isRead ? '' : ' is-unread'}`} key={notification._id}>
              <button className="notification-item-content" type="button" onClick={() => openNotification(notification)}>
                <span className="notification-item-type">{notification.type.replace('_', ' ')}</span>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <time>{notificationTime(notification.createdAt)}</time>
              </button>
              <div className="notification-item-actions">
                {!notification.isRead && <button type="button" className="notification-action" onClick={() => markRead(notification._id)} disabled={pendingId === notification._id}>Mark read</button>}
                <button type="button" className="notification-action danger-text" onClick={() => deleteNotification(notification._id)} disabled={pendingId === notification._id}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="notification-pagination">
          <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages || loading}>Next</button>
        </div>
      )}
    </section>
  )
}

export default Notifications
