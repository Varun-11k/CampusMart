import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { chatApi, lostFoundApi } from '../services/api'
import { useAuth } from '../context/useAuth'

const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(value))

function LostFoundDetails() {
  const { id } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [report, setReport] = useState(null)
  const [claims, setClaims] = useState([])
  const [myClaim, setMyClaim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const owner = Boolean(report && user && String(report.reportedBy?._id) === String(user._id))

  const refresh = async () => {
    const data = await lostFoundApi.get(id, token)
    setReport(data.report)
    setClaims(data.claims || [])
    if (token && data.report && String(data.report.reportedBy?._id) !== String(user?._id)) {
      const mine = await lostFoundApi.myClaims(token)
      setMyClaim((mine.claims || []).find((claim) => String(claim.report?._id) === String(id)) || null)
    }
  }
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    refresh().catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, token, user?._id])

  const contact = async () => {
    if (!token) return navigate('/login', { state: { from: `/lost-found/${id}` } })
    try { const data = await chatApi.startLostFoundConversation(token, id); navigate(`/messages/${data.conversation._id}`) }
    catch (requestError) { setActionError(requestError.message) }
  }
  const submitClaim = async (event) => {
    event.preventDefault(); if (!token) return navigate('/login', { state: { from: `/lost-found/${id}` } })
    setSubmitting(true); setActionError('')
    try { await lostFoundApi.claim(token, id, claimMessage); setClaimOpen(false); setClaimMessage(''); await refresh() }
    catch (requestError) { setActionError(requestError.message) } finally { setSubmitting(false) }
  }
  const decideClaim = async (claimId, status) => {
    setActionError('')
    try { await lostFoundApi.updateClaim(token, id, claimId, status); await refresh() }
    catch (requestError) { setActionError(requestError.message) }
  }
  const markReturned = async () => {
    try { const result = await lostFoundApi.returned(token, id); setReport(result.report); setActionError('') }
    catch (requestError) { setActionError(requestError.message) }
  }

  if (loading) return <section className="placeholder">Loading report...</section>
  if (error || !report) return <section className="placeholder" role="alert"><strong>Unable to load report</strong><span>{error || 'Report not found'}</span><Link className="secondary-button" to="/lost-found">Back to Lost &amp; Found</Link></section>
  const images = report.images || []

  return <section className="lost-found-detail-page"><Link className="text-link" to="/lost-found">← Back to Lost &amp; Found</Link>{location.state?.notice && <p className="form-success" role="status">{location.state.notice}</p>}
    <article className="lost-found-detail"><div className="lost-found-detail-gallery">{images.length ? images.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${report.title}, image ${index + 1}`} />) : <div className="lost-found-detail-placeholder">{report.type === 'lost' ? '🔎' : '📦'}</div>}</div>
      <div className="lost-found-detail-copy"><span className={`lost-found-type ${report.type}`}>{report.type}</span><p className="eyebrow">{report.category}</p><h1>{report.title}</h1><span className={`lost-found-status status-${report.status}`}>{report.status}</span><p className="lost-found-description">{report.description}</p><dl className="lost-found-facts"><div><dt>Location</dt><dd>{report.location}</dd></div><div><dt>Date</dt><dd>{dateLabel(report.date)}</dd></div><div><dt>Reported by</dt><dd>{report.reportedBy?.name || 'CampusMart member'}{report.reportedBy?.college ? ` · ${report.reportedBy.college}` : ''}</dd></div></dl>
        {!owner && report.status === 'active' && <div className="lost-found-detail-actions"><button className="primary-button" type="button" onClick={contact}>Contact {report.type === 'lost' ? 'Owner' : 'Finder'}</button><button className="secondary-button" type="button" onClick={() => setClaimOpen(true)} disabled={Boolean(myClaim)}>Submit Claim</button></div>}
        {myClaim && <p className="claim-status-banner">Your claim status: <strong>{myClaim.status}</strong></p>}
        {owner && <div className="lost-found-detail-actions"><Link className="secondary-button" to={`/lost-found/report?id=${report._id}`}>Edit report</Link>{['active', 'claimed'].includes(report.status) && <button className="secondary-button" type="button" onClick={markReturned}>Mark returned</button>}</div>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </div></article>
    {owner && <section className="lost-found-claims"><div className="section-heading"><div><p className="eyebrow">Report owner</p><h2>Claims ({claims.length})</h2></div></div>{claims.length ? claims.map((claim) => <article className="lost-found-claim" key={claim._id}><div><strong>{claim.claimant?.name || 'Student'}</strong><p>{claim.message}</p><span className={`claim-status status-${claim.status}`}>{claim.status}</span></div>{claim.status === 'pending' && report.status === 'active' && <div className="claim-actions"><button className="primary-button" onClick={() => decideClaim(claim._id, 'approved')}>Approve</button><button className="secondary-button" onClick={() => decideClaim(claim._id, 'rejected')}>Reject</button></div>}</article>) : <div className="empty-state">No claims have been submitted yet.</div>}</section>}
    {claimOpen && <div className="modal-backdrop" onMouseDown={() => !submitting && setClaimOpen(false)}><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">Lost &amp; Found</p><h2 id="claim-title">Submit a claim</h2><form className="form-stack" onSubmit={submitClaim}><label>Why do you believe this item belongs to you?<textarea required maxLength={1000} rows={5} value={claimMessage} onChange={(event) => setClaimMessage(event.target.value)} /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="report-modal-actions"><button className="secondary-button" type="button" onClick={() => setClaimOpen(false)} disabled={submitting}>Cancel</button><button className="primary-button" type="submit" disabled={submitting || !claimMessage.trim()}>{submitting ? 'Submitting...' : 'Submit claim'}</button></div></form></section></div>}
  </section>
}

export default LostFoundDetails
