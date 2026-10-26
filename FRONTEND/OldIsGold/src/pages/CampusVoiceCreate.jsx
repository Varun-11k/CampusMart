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
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!postId || !token) return undefined
    let active = true
    campusVoiceApi.get(postId, token).then(({ post }) => {
      if (!active) return
      if (!post.isMine) { setError('Only your own posts can be edited.'); return }
      setCategory(post.category); setContent(post.content)
    }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId, token])

  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: postId ? `/campus-voices/create?id=${postId}` : '/campus-voices/create' }} />

  const submit = (event) => {
    event.preventDefault()
    if (!content.trim()) { setError('Write something before posting.'); return }
    if (content.trim().length < 10) { setError('Write at least 10 characters.'); return }
    if (content.trim().length > 3000) { setError('Posts must be 3000 characters or fewer.'); return }
    setConfirming(true); setError('')
  }

  const confirmPost = async () => {
    setSubmitting(true); setError('')
    try {
      const result = postId
        ? await campusVoiceApi.update(token, postId, { category, content })
        : await campusVoiceApi.create(token, { category, content })
      const notice = postId
        ? 'Your post was updated.'
        : category === 'confession'
          ? 'Your confession was submitted for moderator review. It will appear in the public feed if approved.'
          : 'Your post was shared anonymously.'
      navigate('/campus-voices/' + result.post._id, { replace: true, state: { notice } })
    } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) }
  }

  return <section className="voice-form-page"><Link className="text-link" to="/campus-voices">&larr; Back to Campus Voices</Link><div className="campus-voices-heading"><div><p className="eyebrow">Your campus, your voice</p><h1>{postId ? 'Edit your post' : 'Share Something'}</h1></div></div>
    <div className="voice-anonymity-note"><span aria-hidden="true">&#9673;</span><p><strong>Anonymous to other students.</strong> Your account is linked privately for abuse prevention and moderation. CampusMart operators can access stored records, and hosting or network logs may identify activity; this is not complete anonymity.</p></div>
    <aside className="voice-guidelines"><strong>Community guidelines</strong><ul><li>Do not threaten, target, bully, impersonate, or harass anyone.</li><li>Do not post names, contact details, student IDs, addresses, or identifying clues about yourself or another student.</li><li>Confessions are text only and reviewed before they appear publicly.</li></ul><p>Deleting a confession hides it from the public feed. Its content and account link may be retained for safety and moderation.</p></aside>
    {loading ? <div className="empty-state">Loading your post...</div> : <form className="form-stack voice-form" onSubmit={submit}>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Your post<textarea value={content} onChange={(event) => { setContent(event.target.value); setError('') }} minLength={10} maxLength={3000} rows={9} required placeholder="What would you like to share with your campus?" /></label>
      <div className="voice-character-count">{content.length} / 3000 characters</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting || loading}>{postId ? 'Review changes' : 'Review before sharing'}</button>
    </form>}
    {confirming && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setConfirming(false) }}><section className="report-modal voice-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-confirm-title">
      <p className="eyebrow">Final check</p><h2 id="voice-confirm-title">{postId ? 'Save these changes?' : 'Submit this post?'}</h2>
      <p>{category === 'confession' ? 'This confession is linked to your account for moderation. Other students will not see your account details. A moderator reviews new confessions before publication.' : 'Your account details are not shown on this public post. CampusMart retains the account link for moderation and abuse prevention.'}</p>
      <blockquote className="voice-confirm-preview">{content.trim()}</blockquote>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="report-modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirming(false)} disabled={submitting}>Go back</button><button type="button" className="primary-button" onClick={confirmPost} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm and submit'}</button></div>
    </section></div>}
  </section>
}

export default CampusVoiceCreate
