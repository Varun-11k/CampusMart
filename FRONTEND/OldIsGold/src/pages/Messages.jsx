import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { chatApi } from '../services/api'

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function Messages() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !token) {
      navigate('/login', { state: { from: '/messages' } })
      return
    }

    let active = true
    chatApi.list(token)
      .then((data) => {
        if (!active) return
        setConversations(data.conversations || [])
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [user, token, navigate])

  const orderedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [conversations],
  )

  if (loading) return <section className="placeholder"><strong>Loading your messages...</strong></section>
  if (error) return <section className="placeholder" role="alert"><strong>Unable to load chats</strong><span>{error}</span></section>

  return (
    <section className="messages-page">
      <div className="page-header-row">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Messages</h1>
        </div>
      </div>

      <div className="messages-list">
        {orderedConversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet.</p>
            <Link className="primary-button" to="/marketplace">Browse listings</Link>
          </div>
        ) : (
          orderedConversations.map((conversation) => {
            const product = conversation.product || conversation.lostFoundReport || conversation.campusExchange || {}
            const otherUser = conversation.otherUser || {}
            const lastMessage = conversation.lastMessage || null

            return (
              <Link key={conversation._id} className="conversation-card" to={`/messages/${conversation._id}`}>
                <div className="conversation-product-thumb">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.title || 'Product'} />
                  ) : (
                    <span className="product-image-placeholder">No photo</span>
                  )}
                </div>

                <div className="conversation-main">
                  <div className="conversation-row">
                    <strong>{otherUser.name || 'Student'}</strong>
                    {conversation.unreadCount > 0 && <span className="unread-pill">{conversation.unreadCount}</span>}
                  </div>
                  <div className="conversation-product-name">{product.title || 'Product conversation'}</div>
                  <p className="conversation-snippet">{lastMessage ? lastMessage.text : 'No messages yet'}</p>
                </div>

                <div className="conversation-side">
                  <span>{formatTime(lastMessage?.createdAt || conversation.updatedAt)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </section>
  )
}

export default Messages
