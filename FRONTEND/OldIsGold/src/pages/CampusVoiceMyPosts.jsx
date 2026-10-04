import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CampusVoiceCard from '../components/CampusVoiceCard'
import { campusVoiceApi } from '../services/api'

function CampusVoiceMyPosts() {
  const { user, token, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState('')

  useEffect(() => {
    if (!token) return undefined
    let active = true
    setLoading(true); setError(false)
    campusVoiceApi.myPosts(token, page).then((data) => { if (active) { setPosts(data.posts || []); setPages(data.pagination?.pages || 1) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, token])

  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: '/campus-voices/my-posts' }} />
  const remove = async (post) => {
    if (!window.confirm('Delete this post?')) return
    setPending(post._id)
    try { await campusVoiceApi.remove(token, post._id); setPosts((current) => current.filter((item) => item._id !== post._id)) }
    catch { setError(true) } finally { setPending('') }
  }
  const like = async (post) => {
    setPending(post._id)
    try { const result = await campusVoiceApi.like(token, post._id); setPosts((current) => current.map((item) => item._id === post._id ? { ...item, ...result } : item)) }
    catch { setError(true) } finally { setPending('') }
  }

  return <section className="campus-voices-page"><div className="campus-voices-heading"><div><p className="eyebrow">Your writing</p><h1>My Posts</h1><p>Your posts remain anonymous to the campus community.</p></div><div className="voice-page-actions"><Link className="secondary-button" to="/campus-voices">All voices</Link><Link className="primary-button" to="/campus-voices/create">Share Something</Link></div></div>
    {error && <div className="voice-error" role="alert">Something went wrong. Please try again.</div>}{loading ? <div className="empty-state">Loading your posts...</div> : posts.length ? <div className="campus-voice-list">{posts.map((post) => <CampusVoiceCard key={post._id} post={post} showManage onLike={like} likePending={pending === post._id} onDelete={remove} />)}</div> : <div className="empty-state">No campus voices yet.</div>}
    {pages > 1 && <div className="voice-pagination"><button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
  </section>
}

export default CampusVoiceMyPosts
