import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CampusVoiceReportButton from '../components/CampusVoiceReportButton'
import { campusVoiceApi } from '../services/api'

const names = { confession: 'Confession', question: 'Question', suggestion: 'Suggestion', experience: 'Experience', opinion: 'Opinion' }
const dateTime = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))

function CampusVoiceDetails() {
  const { id } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    campusVoiceApi.get(id, token).then(({ post: next }) => { if (active) setPost(next) }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, token])

  const like = async () => {
    if (!token) return navigate('/login', { state: { from: `/campus-voices/${id}` } })
    setLikePending(true); setActionError('')
    try { const result = await campusVoiceApi.like(token, id); setPost((current) => ({ ...current, likeCount: result.likeCount, likedByMe: result.likedByMe })) }
    catch { setActionError('Something went wrong. Please try again.') } finally { setLikePending(false) }
  }
  const remove = async () => {
    if (!window.confirm('Delete this post?')) return
    try { await campusVoiceApi.remove(token, id); navigate('/campus-voices/my-posts', { replace: true }) }
    catch { setActionError('Something went wrong. Please try again.') }
  }

  if (loading) return <section className="placeholder">Loading post...</section>
  if (error || !post) return <section className="placeholder" role="alert"><strong>Something went wrong. Please try again.</strong><Link className="secondary-button" to="/campus-voices">Back to Campus Voices</Link></section>

  return <section className="voice-detail-page"><Link className="text-link" to="/campus-voices">← Back to Campus Voices</Link>{location.state?.notice && <p className="form-success" role="status">{location.state.notice}</p>}
    <article className="campus-voice-detail"><div className="campus-voice-card-header"><span className={`voice-category category-${post.category}`}>{names[post.category]}</span>{post.status !== 'active' && <span className={`voice-status status-${post.status}`}>{post.status}</span>}</div><h1>Anonymous Student</h1><time dateTime={post.createdAt}>{dateTime(post.createdAt)}</time><p className="campus-voice-detail-content">{post.content}</p><div className="campus-voice-actions">{post.status === 'active' && <button type="button" className={`voice-action-button${post.likedByMe ? ' is-liked' : ''}`} disabled={likePending} onClick={like}>{post.likedByMe ? '♥ Liked' : '♡ Like'} <span>{post.likeCount || 0}</span></button>}{!post.isMine && post.status === 'active' && <CampusVoiceReportButton postId={post._id} />}{post.isMine && post.status === 'active' && <Link className="voice-action-button" to={`/campus-voices/create?id=${post._id}`}>Edit</Link>}{post.isMine && <button className="voice-action-button is-danger" onClick={remove}>Delete</button>}</div>{actionError && <p className="form-error" role="alert">{actionError}</p>}</article>
    <p className="voice-privacy-note">Campus Voices posts do not display their author’s name, email, phone, or account ID.</p>
  </section>
}

export default CampusVoiceDetails
