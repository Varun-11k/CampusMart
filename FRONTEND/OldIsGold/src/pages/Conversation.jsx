import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../context/useAuth'
import { chatApi } from '../services/api'

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function ConversationPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [typingUser, setTypingUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [socketError, setSocketError] = useState('')
  const [sending, setSending] = useState(false)
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    if (!user || !token) {
      navigate('/login', { state: { from: `/messages/${conversationId}` } })
      return
    }

    let active = true

    chatApi.messages(token, conversationId)
      .then((data) => {
        if (!active) return
        setConversation(data.conversation || null)
        setMessages(data.messages || [])
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [conversationId, navigate, token, user])

  useEffect(() => {
    if (!token || !conversationId) return

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'
    const socket = io(socketUrl, {
      auth: { token },
    })

    socketRef.current = socket
    const joinConversation = () => {
      socket.emit('join_conversation', { conversationId }, (response) => {
        if (!response?.success) {
          setSocketError(response?.message || 'Unable to join this conversation in real time.')
          return
        }

        setSocketError('')
        socket.emit('message_read', { conversationId })
      })
    }

    socket.on('connect', joinConversation)
    socket.on('connect_error', (socketRequestError) => {
      setSocketError(socketRequestError.message || 'Real-time connection unavailable.')
    })
    if (socket.connected) joinConversation()

    socket.on('receive_message', (payload) => {
      if (String(payload?.conversationId) !== String(conversationId)) return
      const incomingMessage = payload.message
      if (!incomingMessage) return
      setMessages((current) => {
        if (current.some((message) => message._id === incomingMessage._id)) {
          return current
        }
        return [...current, incomingMessage]
      })
      const senderId = incomingMessage.sender?._id || incomingMessage.sender
      if (String(senderId) !== String(user?._id)) {
        socket.emit('message_read', { conversationId })
      }
    })

    socket.on('typing', (payload) => {
      if (String(payload?.conversationId) === String(conversationId)) {
        setTypingUser(payload.user || null)
      }
    })

    socket.on('stop_typing', (payload) => {
      if (String(payload?.conversationId) === String(conversationId)) {
        setTypingUser(null)
      }
    })

    socket.on('message_read', (payload) => {
      if (String(payload?.conversationId) !== String(conversationId)) return
      setMessages((current) => current.map((message) => {
        const senderId = message.sender?._id || message.sender
        return String(senderId) === String(user?._id) ? { ...message, read: true } : message
      }))
    })

    return () => {
      socket.emit('leave_conversation', { conversationId })
      socket.disconnect()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      socketRef.current = null
    }
  }, [conversationId, token, user?._id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const product = useMemo(() => conversation?.product || conversation?.lostFoundReport || conversation?.campusExchange || null, [conversation])

  const handleTextChange = (event) => {
    const nextText = event.target.value
    setText(nextText)

    const socket = socketRef.current
    if (!socket?.connected) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (nextText.trim()) {
      socket.emit('typing', { conversationId })
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { conversationId })
      }, 900)
    } else {
      socket.emit('stop_typing', { conversationId })
    }
  }

  const sendMessage = (event) => {
    event.preventDefault()
    if (!text.trim() || !conversationId || sending) return

    const socket = socketRef.current
    if (!socket?.connected) {
      setSocketError('Real-time connection unavailable. Reconnect before sending.')
      return
    }

    setSending(true)
    setSocketError('')
    socket.timeout(10000).emit('send_message', { conversationId, text }, (timeoutError, response) => {
      setSending(false)
      if (timeoutError) {
        setSocketError('Message could not be sent. Check your connection and try again.')
        return
      }
      if (!response?.success) {
        setSocketError(response?.message || 'Message could not be sent.')
        return
      }

      setMessages((current) => {
        if (current.some((message) => message._id === response.message?._id)) {
          return current
        }
        return [...current, response.message]
      })
      setText('')
      socket.emit('stop_typing', { conversationId })
    })
  }

  if (loading) return <section className="placeholder"><strong>Loading conversation...</strong></section>
  if (error) return <section className="placeholder" role="alert"><strong>Unable to open chat</strong><span>{error}</span></section>

  const otherUser = (conversation?.participants || []).find((participant) => participant._id !== user?._id) || null

  return (
    <section className="conversation-page">
      <div className="page-header-row conversation-header">
        <div>
          <Link className="secondary-button" to="/messages">← Back to messages</Link>
        </div>
        <div className="conversation-heading-text">
          <p className="eyebrow">Chat</p>
          <h1>{otherUser?.name || 'Conversation'}</h1>
        </div>
      </div>

      {product && (
        <div className="conversation-product-bar">
          <div className="conversation-product-thumb compact">
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt={product.title || 'Product'} />
            ) : (
              <span className="product-image-placeholder">No photo</span>
            )}
          </div>
          <div>
            <strong>{product.title}</strong>
            <div className="conversation-product-meta">{product.type ? `${product.type === 'lost' ? 'Lost item' : 'Found item'} · ${product.category}` : `${product.category} · ${product.condition}`}</div>
          </div>
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state narrow">
              <p>No messages yet. Start the conversation.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.sender?._id === user?._id || message.sender === user?._id
              return (
                <div key={message._id} className={`chat-bubble-row ${isMine ? 'mine' : ''}`}>
                  <div className="chat-bubble">
                    <div className="chat-message-text">{message.text}</div>
                    <div className="chat-message-meta">{formatTime(message.createdAt)}{isMine && message.read ? ' · Read' : ''}</div>
                  </div>
                </div>
              )
            })
          )}
          {typingUser && <p className="chat-typing-indicator">{typingUser.name || 'Student'} is typing...</p>}
          <div ref={messagesEndRef} />
        </div>

        {socketError && <p className="form-error" role="alert">{socketError}</p>}

        <form className="chat-composer" onSubmit={sendMessage}>
          <input
            type="text"
            value={text}
            placeholder="Type your message..."
            maxLength={5000}
            onChange={handleTextChange}
            disabled={sending}
          />
          <button type="submit" className="primary-button" disabled={sending || !text.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default ConversationPage
