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
    if (!window.confirm('Delete this post? It will be hidden from the public feed. Its content and account link may be retained for safety and moderation.')) return
    try { await campusVoiceApi.remove(token, id); navigate('/campus-voices/my-posts', { replace: true }) }
    catch { setActionError('Something went wrong. Please try again.') }
  }

  if (loading) return <section className="placeholder">Loading post...</section>
  if (error || !post) return <section className="placeholder" role="alert"><strong>Something went wrong. Please try again.</strong><Link className="secondary-button" to="/campus-voices">Back to Campus Voices</Link></section>

  const privateStatus = { pending: 'Pending moderator review', hidden: 'Hidden from the public feed', rejected: 'Rejected by moderation', removed: post.deletedByAuthor ? 'Deleted by you' : 'Removed by moderation' }
  const canEdit = !['rejected', 'removed'].includes(post.moderationStatus)
  return <section className="voice-detail-page"><Link className="text-link" to="/campus-voices">&larr; Back to Campus Voices</Link>{location.state?.notice && <p className="form-success" role="status">{location.state.notice}</p>}
    <article className="campus-voice-detail"><div className="campus-voice-card-header"><span className={`voice-category category-${post.category}`}>{names[post.category]}</span></div><h1>Anonymous Student</h1><time dateTime={post.createdAt}>{dateTime(post.createdAt)}</time>{post.isMine && post.moderationStatus !== 'active' && <p className="voice-private-status">{privateStatus[post.moderationStatus] || 'Not published'}</p>}<p className="campus-voice-detail-content">{post.content}</p><div className="campus-voice-actions">{!post.isMine && <button type="button" className={`voice-action-button${post.likedByMe ? ' is-liked' : ''}`} disabled={likePending} onClick={like}>{post.likedByMe ? <>&hearts; Liked</> : <>&#9825; Like</>} <span>{post.likeCount || 0}</span></button>}{!post.isMine && <CampusVoiceReportButton postId={post._id} />}{post.isMine && canEdit && <Link className="voice-action-button" to={`/campus-voices/create?id=${post._id}`}>Edit</Link>}{post.isMine && post.moderationStatus !== 'removed' && <button className="voice-action-button is-danger" onClick={remove}>Delete</button>}</div>{actionError && <p className="form-error" role="alert">{actionError}</p>}</article>
    <p className="voice-privacy-note">Post authors are hidden from other students and public APIs. CampusMart stores an account link for moderation and abuse prevention; technical hosting and network logs are outside this public privacy boundary.</p>
    <p className="voice-comments-note">Comments are not available for confessions in this release. Use Report to alert moderators about a safety concern.</p>
  </section>
}

export default CampusVoiceDetails
