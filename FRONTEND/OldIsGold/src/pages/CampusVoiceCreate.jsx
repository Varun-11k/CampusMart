import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusVoiceApi } from '../services/api'

const categories = [
  ['confession', 'Confession'],
  ['question', 'Question'],
  ['suggestion', 'Suggestion'],
  ['experience', 'Experience'],
  ['opinion', 'Opinion'],
]

function CampusVoiceCreate() {
  const { user, token, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const postId = params.get('id')
  const [category, setCategory] = useState('confession')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(Boolean(postId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!postId || !token) return undefined
    let active = true
    campusVoiceApi.get(postId, token).then(({ post }) => {
      if (!active) return
      if (!post.isMine || post.status !== 'active') { setError('Only your active posts can be edited.'); return }
      setCategory(post.category); setContent(post.content)
    }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId, token])

  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: postId ? `/campus-voices/create?id=${postId}` : '/campus-voices/create' }} />

  const submit = async (event) => {
    event.preventDefault()
    if (!content.trim()) { setError('Write something before posting.'); return }
    if (content.trim().length > 3000) { setError('Posts must be 3000 characters or fewer.'); return }
    setSubmitting(true); setError('')
    try {
      const result = postId
        ? await campusVoiceApi.update(token, postId, { category, content })
        : await campusVoiceApi.create(token, { category, content })
      navigate(`/campus-voices/${result.post._id}`, { replace: true, state: { notice: postId ? 'Your post was updated.' : 'Your post was shared anonymously.' } })
    } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) }
  }

  return <section className="voice-form-page"><Link className="text-link" to="/campus-voices">← Back to Campus Voices</Link><div className="campus-voices-heading"><div><p className="eyebrow">Your campus, your voice</p><h1>{postId ? 'Edit your post' : 'Share Something'}</h1></div></div>
    <div className="voice-anonymity-note"><span aria-hidden="true">◉</span><p><strong>Your identity stays private.</strong> Your post is shared as Anonymous Student. Your account is used only for moderation and abuse prevention.</p></div>
    {loading ? <div className="empty-state">Loading your post...</div> : <form className="form-stack voice-form" onSubmit={submit}>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Your post<textarea value={content} onChange={(event) => { setContent(event.target.value); setError('') }} maxLength={3000} rows={9} required placeholder="What would you like to share with your campus?" /></label>
      <div className="voice-character-count">{content.length} / 3000 characters</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting || loading}>{submitting ? postId ? 'Saving...' : 'Posting...' : postId ? 'Save changes' : 'Post Anonymously'}</button>
    </form>}
  </section>
}

export default CampusVoiceCreate
