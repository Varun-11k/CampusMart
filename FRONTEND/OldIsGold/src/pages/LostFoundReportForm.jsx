import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { lostFoundApi } from '../services/api'

const categories = ['Electronics', 'Wallets & Cards', 'Keys', 'Clothing', 'Books', 'Bags', 'Other']
const emptyForm = (type) => ({ type, title: '', category: '', description: '', location: '', date: '', images: [] })

function LostFoundReportForm() {
  const { user, token, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id')
  const [form, setForm] = useState(() => emptyForm(params.get('type') === 'found' ? 'found' : 'lost'))
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(Boolean(editId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editId || !token) return undefined
    let active = true
    lostFoundApi.get(editId, token).then(({ report }) => {
      if (!active) return
      if (String(report.reportedBy?._id) !== String(user?._id) || report.status !== 'active') { setError('Only your active reports can be edited.'); return }
      setForm({ type: report.type, title: report.title, category: report.category, description: report.description, location: report.location, date: new Date(report.date).toISOString().slice(0, 10), images: report.images || [] })
    }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editId, token, user?._id])

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: editId ? `/lost-found/report?id=${editId}` : `/lost-found/report?type=${form.type}` }} />

  const changeFiles = (input) => {
    const selected = Array.from(input || [])
    const room = Math.max(0, 5 - form.images.length)
    const valid = selected.slice(0, room).filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) && file.size <= 5 * 1024 * 1024)
    setFiles(valid); setPreviews(valid.map((file) => URL.createObjectURL(file)))
    setError(selected.length > room ? 'You can upload up to 5 total images.' : selected.length !== valid.length ? 'Images must be JPG, PNG, WEBP, or GIF and 5MB or smaller.' : '')
  }
  const submit = async (event) => {
    event.preventDefault(); if (submitting) return
    setSubmitting(true); setError('')
    try {
      const result = editId ? await lostFoundApi.update(token, editId, form, files) : await lostFoundApi.create(token, form, files)
      navigate(`/lost-found/${result.report._id}`, { replace: true, state: { notice: editId ? 'Report updated.' : 'Your report was submitted.' } })
    } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) }
  }
  const removeImage = (index) => setForm((current) => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))

  return <section className="lost-found-form-page"><Link className="text-link" to="/lost-found">← Back to Lost &amp; Found</Link><div className="page-header-row"><div><p className="eyebrow">Help your campus community</p><h1>{editId ? 'Edit report' : 'Submit a report'}</h1></div></div>{loading ? <div className="empty-state">Loading report...</div> : <form className="form-stack lost-found-form" onSubmit={submit}>
    <label>Type<select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="lost">Lost</option><option value="found">Found</option></select></label>
    <label>Item name<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
    <label>Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Choose a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label>Description<textarea required maxLength={2000} rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    <label>Location<input required maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Where was it last seen or found?" /></label>
    <label>Date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
    <label>Images (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => changeFiles(event.target.files)} /></label>
    {(form.images.length > 0 || previews.length > 0) && <div className="lost-found-previews">{form.images.map((url, index) => <div key={url}><img src={url} alt={`Current item image ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label="Remove image">×</button></div>)}{previews.map((url, index) => <div key={url}><img src={url} alt={`New image preview ${index + 1}`} /></div>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={submitting || loading}>{submitting ? 'Uploading and submitting...' : editId ? 'Save changes' : 'Submit report'}</button>
  </form>}</section>
}

export default LostFoundReportForm
