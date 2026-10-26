import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusFeedApi } from '../services/api'

const categories = [
  ['general', 'General'], ['update', 'Update'], ['meme', 'Meme'], ['food', 'Food'], ['sports', 'Sports'],
  ['study', 'Study'], ['event', 'Event'], ['club', 'Club'], ['marketplace', 'Marketplace'], ['lostfound', 'Lost & Found'], ['question', 'Question'],
]

function CampusFeedEdit() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [hashtags, setHashtags] = useState('')
  const [campusTag, setCampusTag] = useState('')
  const [visibility, setVisibility] = useState('campus')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    campusFeedApi.get(id, token).then((data) => {
      const item = data.post
      if (!item.isMine) { setError('You can only edit your own posts.'); return }
      setPost(item); setContent(item.content || ''); setCategory(item.category || 'general')
      setHashtags((item.hashtags || []).join(' ')); setCampusTag(item.campusTag || ''); setVisibility(item.visibility || 'campus')
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [id, token])

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true); setError('')
    try {
      await campusFeedApi.update(token, id, {
        content: content.trim(),
        category,
        hashtags: hashtags.trim(),
        campusTag: campusTag.trim(),
        visibility,
      })
      navigate('/campus-feed/mine')
    } catch (requestError) {
      setError(requestError.message || 'Could not update post')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <section className="placeholder">Loading post...</section>
  if (error) return <section className="voice-error" role="alert">{error} <Link to="/campus-feed">Back</Link></section>

  return (
    <section className="campus-feed-page">
      <div className="campus-feed-header">
        <div><p className="eyebrow">Edit post</p><h1>Edit your post</h1></div>
        <Link className="secondary-button" to="/campus-feed/mine">Back</Link>
      </div>
      <form className="feed-composer" onSubmit={submit}>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} maxLength={3000} />
        <div className="composer-row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#hashtags" />
          <input value={campusTag} onChange={(e) => setCampusTag(e.target.value)} placeholder="Campus tag" />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="campus">Campus</option>
            <option value="public">Public</option>
          </select>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save changes'}</button>
      </form>
    </section>
  )
}

export default CampusFeedEdit