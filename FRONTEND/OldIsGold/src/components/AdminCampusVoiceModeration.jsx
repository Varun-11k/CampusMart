import { useEffect, useState } from 'react'
import { adminApi } from '../services/api'

const statuses = [
  ['pending', 'Pending review'],
  ['active', 'Published'],
  ['hidden', 'Hidden'],
  ['rejected', 'Rejected'],
  ['removed', 'Removed'],
]

const statusLabels = Object.fromEntries(statuses)

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function AdminCampusVoiceModeration({ token }) {
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    adminApi.campusVoices(token, { status, page, limit: 10 })
      .then((data) => {
        if (!active) return
        setPosts(data.posts || [])
        setPages(data.pagination?.pages || 1)
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, status, token])

  const moderate = async (post, nextStatus) => {
    const label = statusLabels[nextStatus] || nextStatus
    if (['rejected', 'removed'].includes(nextStatus) && !window.confirm(label + ' this confession? It will no longer appear in the public feed.')) return
    setPending(post._id)
    setError('')
    setNotice('')
    try {
      const data = await adminApi.moderateCampusVoice(token, post._id, { status: nextStatus })
      setPosts((current) => status && status !== data.post.moderationStatus
        ? current.filter((item) => item._id !== post._id)
        : current.map((item) => item._id === post._id ? data.post : item))
      setNotice('Confession marked ' + label.toLowerCase() + '.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending('')
    }
  }

  return <section className="admin-section" aria-labelledby="admin-confessions-title">
    <div className="admin-section-heading">
      <div><p className="eyebrow">Private moderation queue</p><h2 id="admin-confessions-title">Confessions</h2><p>Author identities are not included in this review queue.</p></div>
      <label className="admin-filter">Status
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {loading ? <div className="empty-state compact-empty" role="status">Loading confessions...</div>
      : posts.length ? <div className="admin-report-list">{posts.map((post) => (
        <article className="admin-detail-panel" key={post._id}>
          <div className="admin-detail-heading"><h3>Anonymous confession</h3><span className={'admin-status status-' + post.moderationStatus}>{statusLabels[post.moderationStatus] || post.moderationStatus}</span></div>
          <p className="admin-voice-content">{post.content}</p>
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
          {post.moderationHistory?.length > 0 && <details className="voice-moderation-history"><summary>Moderation history</summary><ul>{post.moderationHistory.map((entry, index) => <li key={(entry.createdAt || '') + '-' + index}><strong>{statusLabels[entry.action] || entry.action}</strong> · {formatDate(entry.createdAt)}{entry.note && <span>{entry.note}</span>}</li>)}</ul></details>}
          <div className="admin-row-actions">
            {post.moderationStatus !== 'active' && <button type="button" className="admin-action" onClick={() => moderate(post, 'active')} disabled={pending === post._id}>Approve / restore</button>}
            {post.moderationStatus !== 'hidden' && <button type="button" className="admin-action" onClick={() => moderate(post, 'hidden')} disabled={pending === post._id}>Hide</button>}
            {post.moderationStatus !== 'rejected' && <button type="button" className="admin-action danger-text" onClick={() => moderate(post, 'rejected')} disabled={pending === post._id}>Reject</button>}
            {post.moderationStatus !== 'removed' && <button type="button" className="admin-action danger-text" onClick={() => moderate(post, 'removed')} disabled={pending === post._id}>Remove</button>}
          </div>
        </article>
      ))}</div> : <div className="empty-state compact-empty">No confessions in this queue.</div>}
    {pages > 1 && <div className="notification-pagination"><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages}>Next</button></div>}
  </section>
}

export default AdminCampusVoiceModeration
