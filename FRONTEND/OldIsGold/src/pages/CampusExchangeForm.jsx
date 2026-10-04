import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusExchangeApi } from '../services/api'

const categories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
const conditions = ['New', 'Like New', 'Good', 'Fair']
const initial = { title: '', description: '', category: 'Books', condition: 'Good', offeredItem: '', wantedItem: '', openToOffers: false, location: '', images: [] }

function CampusExchangeForm() {
  const { user, token, loading: authLoading } = useAuth()
  const [params] = useSearchParams(); const id = params.get('id')
  const navigate = useNavigate()
  const [form, setForm] = useState(initial); const [files, setFiles] = useState([]); const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(id)); const [saving, setSaving] = useState(false)
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  useEffect(() => {
    if (!id || !token) return
    let active = true
    campusExchangeApi.get(id, token).then(({ exchange }) => {
      if (!active) return
      if (!exchange.isMine || exchange.status !== 'active') { setError('Only your active exchanges can be edited.'); return }
      setForm({ title: exchange.title, description: exchange.description || '', category: exchange.category, condition: exchange.condition, offeredItem: exchange.offeredItem, wantedItem: exchange.wantedItem, openToOffers: Boolean(exchange.openToOffers), location: exchange.location, images: exchange.images || [] })
    }).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id, token])
  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace />
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (!form.title.trim() || !form.offeredItem.trim() || !form.wantedItem.trim() || !form.location.trim()) return setError('Complete the title, items, and campus location fields.')
    if (form.description.length > 2000 || form.title.length > 120 || form.offeredItem.length > 200 || form.wantedItem.length > 200) return setError('One or more fields exceed their character limit.')
    if (form.images.length + files.length > 5) return setError('You can upload up to 5 images.')
    setSaving(true)
    try {
      const result = id ? await campusExchangeApi.update(token, id, form, files) : await campusExchangeApi.create(token, form, files)
      navigate(`/campus-exchange/${result.exchange._id}`, { replace: true })
    } catch (requestError) { setError(requestError.message || 'Unable to save exchange. Please try again.') }
    finally { setSaving(false) }
  }
  return <section className="resource-form-page"><Link className="text-link" to="/campus-exchange">← Back to Campus Exchange</Link><div className="resources-heading"><div><p className="eyebrow">Make a useful swap</p><h1>{id ? 'Edit Exchange' : 'Create Exchange'}</h1><p>Your college is taken from your account. Don’t add a home address or private contact details.</p></div></div>
    <form className="form-stack resource-form exchange-form" onSubmit={submit}><label>Title<input required maxLength={120} value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="Engineering Books Exchange" /></label><label>What are you offering?<input required maxLength={200} value={form.offeredItem} onChange={(event) => set('offeredItem', event.target.value)} /></label><label>What do you want?<input required maxLength={200} value={form.wantedItem} onChange={(event) => set('wantedItem', event.target.value)} /></label><label>Description<textarea maxLength={2000} rows={5} value={form.description} onChange={(event) => set('description', event.target.value)} /></label><label className="exchange-open-offers"><input type="checkbox" checked={form.openToOffers} onChange={(event) => set('openToOffers', event.target.checked)} /> Open to alternative exchange offers</label><div className="resource-form-grid"><label>Category<select value={form.category} onChange={(event) => set('category', event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Condition<select value={form.condition} onChange={(event) => set('condition', event.target.value)}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Campus location<input required maxLength={120} value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="North campus library" /></label></div>
      <label>Images (JPG, PNG, WEBP, GIF; max 5MB each)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => { const selected = Array.from(event.target.files || []); setFiles(selected); event.target.value = '' }} />{files.map((file, index) => <small key={`${file.name}-${index}`}>{file.name}</small>)}</label>
      {!!form.images.length && <div className="exchange-image-previews">{form.images.map((url, index) => <button type="button" key={url} onClick={() => set('images', form.images.filter((_, position) => position !== index))} aria-label="Remove existing image"><img src={url} alt="Existing listing" /><span>Remove</span></button>)}</div>}
      {!!previews.length && <div className="exchange-image-previews">{previews.map((url) => <img key={url} src={url} alt="Selected preview" />)}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={saving || loading}>{saving ? 'Saving...' : id ? 'Save Changes' : 'Create Exchange'}</button></form>
  </section>
}

export default CampusExchangeForm
