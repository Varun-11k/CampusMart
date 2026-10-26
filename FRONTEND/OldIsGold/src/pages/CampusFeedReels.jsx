import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusFeedApi } from '../services/api'
import '../campusFeed.css'

function CampusFeedReels() {
  const { token } = useAuth()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    campusFeedApi.reels({ page, limit: 10 }, token).then((data) => {
      if (!active) return
      setPosts(data.posts || [])
      setPages(data.pagination?.pages || 1)
    }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load reels') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, token])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const videos = Array.from(container.querySelectorAll('video'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      })
    }, { threshold: [0.6] })
    videos.forEach((video) => observer.observe(video))
    return () => observer.disconnect()
  }, [posts])

  const toggleMute = (event) => {
    const video = event.currentTarget.parentElement?.querySelector('video')
    if (video) video.muted = !video.muted
  }

  return (
    <section className="reels-page">
      <div className="campus-feed-header">
        <div><p className="eyebrow">Reels</p><h1>Campus Reels</h1><p>Short vertical videos from your campus community.</p></div>
        <Link className="secondary-button" to="/campus-feed">Back to feed</Link>
      </div>
      {loading ? <div className="feed-skeleton">Loading reels...</div> :
       error ? <div className="voice-error" role="alert">{error}</div> :
       posts.length === 0 ? <div className="empty-state">No reels yet.</div> : (
        <div className="reels-container" ref={containerRef}>
          {posts.map((post) => (
            <article key={post._id} className="reel-card">
              <div className="reel-media">
                {post.media?.filter((item) => item.type === 'video').map((item, index) => (
                  <video key={index} src={item.url} muted playsInline preload="metadata" loop className="reel-video" />
                ))}
                <div className="reel-overlay">
                  <strong>{post.author?.name || 'Student'}</strong>
                  <p>{post.content}</p>
                  <div className="reel-actions">
                    <span>♥ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                    <button type="button" onClick={toggleMute}>Mute/Unmute</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="feed-pagination">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="secondary-button" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      )}
    </section>
  )
}

export default CampusFeedReels