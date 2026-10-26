import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { chatApi, lostFoundApi, reportApi } from '../services/api'
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
  const [abuseOpen, setAbuseOpen] = useState(false)
  const [abuseReason, setAbuseReason] = useState('')
  const owner = Boolean(report?.isMine)

  const refresh = async () => {
    const data = await lostFoundApi.get(id, token)
    setReport(data.report)
    setClaims(data.claims || [])
    if (token && data.report && !data.report.isMine) {
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
    try {
      if (myClaim?.status === 'more_info_requested') await lostFoundApi.replyToClaim(token, id, myClaim._id, claimMessage)
      else await lostFoundApi.claim(token, id, claimMessage)
      setClaimOpen(false); setClaimMessage(''); await refresh()
    }
    catch (requestError) { setActionError(requestError.message) } finally { setSubmitting(false) }
  }
  const decideClaim = async (claimId, status) => {
    setActionError('')
    try {
      let note = ''
      if (status === 'more_info_requested') {
        note = window.prompt('What additional distinguishing details should the claimant provide?') || ''
        if (!note.trim()) return
      }
      await lostFoundApi.updateClaim(token, id, claimId, status, note); await refresh()
    }
    catch (requestError) { setActionError(requestError.message) }
  }
  const markReturned = async () => {
    try { const result = await lostFoundApi.returned(token, id); setReport(result.report); setActionError('') }
    catch (requestError) { setActionError(requestError.message) }
  }
  const closeReport = async () => {
    if (!window.confirm('Close this report? You can reopen it later from My reports.')) return
    try { const result = await lostFoundApi.setStatus(token, id, 'closed'); setReport(result.report); setActionError('Report closed.') }
    catch (requestError) { setActionError(requestError.message) }
  }
  const reopenReport = async () => {
    try { const result = await lostFoundApi.setStatus(token, id, 'active'); setReport(result.report); setActionError('Report reopened.') }
    catch (requestError) { setActionError(requestError.message) }
  }
  const submitAbuseReport = async (event) => {
    event.preventDefault()
    if (!abuseReason || !token) return
    try {
      await reportApi.create(token, { lostFoundReportId: id, reason: abuseReason })
      setAbuseOpen(false); setAbuseReason(''); setActionError('Report sent to CampusMart moderation.')
    } catch (requestError) { setActionError(requestError.message) }
  }

  if (loading) return <section className="placeholder">Loading report...</section>
  if (error || !report) return <section className="placeholder" role="alert"><strong>Unable to load report</strong><span>{error || 'Report not found'}</span><Link className="secondary-button" to="/lost-found">Back to Lost &amp; Found</Link></section>
  const images = report.images || []

  return <section className="lost-found-detail-page"><Link className="text-link" to="/lost-found">← Back to Lost &amp; Found</Link>{location.state?.notice && <p className="form-success" role="status">{location.state.notice}</p>}
    <article className="lost-found-detail"><div className="lost-found-detail-gallery">{images.length ? images.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${report.title}, image ${index + 1}`} />) : <div className="lost-found-detail-placeholder">{report.type === 'lost' ? '🔎' : '📦'}</div>}</div>
      <div className="lost-found-detail-copy"><span className={`lost-found-type ${report.type}`}>{report.type}</span><p className="eyebrow">{report.category}</p><h1>{report.title}</h1><span className={`lost-found-status status-${report.status}`}>{report.status === 'active' ? 'Open' : report.status.replaceAll('_', ' ')}</span><p className="lost-found-description">{report.description}</p><dl className="lost-found-facts"><div><dt>Location</dt><dd>{report.location}</dd></div><div><dt>Date</dt><dd>{dateLabel(report.date)}</dd></div><div><dt>Reported by</dt><dd>{report.reportedBy?.name || 'CampusMart member'}{report.reportedBy?.college ? ` · ${report.reportedBy.college}` : ''}</dd></div></dl>
        {!owner && report.status === 'active' && <div className="lost-found-detail-actions">{report.contactPreference !== 'claims_only' && <button className="primary-button" type="button" onClick={contact}>Message {report.type === 'lost' ? 'Reporter' : 'Finder'}</button>}<button className="secondary-button" type="button" onClick={() => { setClaimMessage(myClaim?.reviewerNote || ''); setClaimOpen(true) }} disabled={Boolean(myClaim && myClaim.status !== 'more_info_requested')}>{myClaim?.status === 'more_info_requested' ? 'Reply with details' : 'I can identify this item'}</button><button className="text-link-button" type="button" onClick={() => token ? setAbuseOpen(true) : navigate('/login', { state: { from: `/lost-found/${id}` } })}>Report this post</button></div>}
        {myClaim && <p className="claim-status-banner">Your claim status: <strong>{myClaim.status.replaceAll('_', ' ')}</strong>{myClaim.reviewerNote && <span> · {myClaim.reviewerNote}</span>}</p>}
        {owner && <div className="lost-found-detail-actions">{report.status === 'active' && <Link className="secondary-button" to={`/lost-found/report?id=${report._id}`}>Edit report</Link>}{['active', 'claimed'].includes(report.status) && <button className="secondary-button" type="button" onClick={markReturned}>Mark returned</button>}{['active', 'claimed', 'under_review'].includes(report.status) && <button className="secondary-button" type="button" onClick={closeReport}>Close report</button>}{report.status === 'closed' && <button className="secondary-button" type="button" onClick={reopenReport}>Reopen report</button>}</div>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </div></article>
    {owner && <section className="lost-found-claims"><div className="section-heading"><div><p className="eyebrow">Report owner</p><h2>Claims ({claims.length})</h2></div></div>{claims.length ? claims.map((claim) => <article className="lost-found-claim" key={claim._id}><div><strong>{claim.claimant?.name || 'Student'}</strong><p>{claim.message}</p><span className={`claim-status status-${claim.status}`}>{claim.status.replaceAll('_', ' ')}</span></div>{['pending', 'more_info_requested'].includes(claim.status) && ['active', 'under_review'].includes(report.status) && <div className="claim-actions"><button className="primary-button" onClick={() => decideClaim(claim._id, 'approved')}>Approve</button><button className="secondary-button" onClick={() => decideClaim(claim._id, 'more_info_requested')}>Request details</button><button className="secondary-button" onClick={() => decideClaim(claim._id, 'rejected')}>Reject</button></div>}</article>) : <div className="empty-state">No claims have been submitted yet.</div>}</section>}
    {claimOpen && <div className="modal-backdrop" onMouseDown={() => !submitting && setClaimOpen(false)}><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">Lost &amp; Found</p><h2 id="claim-title">{myClaim?.status === 'more_info_requested' ? 'Reply with more details' : 'Identify this item'}</h2><p className="form-copy">Share distinguishing information that is not shown in the public report. Only the reporter and authorized moderators can see your response.</p><form className="form-stack" onSubmit={submitClaim}><label>What details help identify this item?<textarea required maxLength={1000} rows={5} value={claimMessage} onChange={(event) => setClaimMessage(event.target.value)} /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="report-modal-actions"><button className="secondary-button" type="button" onClick={() => setClaimOpen(false)} disabled={submitting}>Cancel</button><button className="primary-button" type="submit" disabled={submitting || !claimMessage.trim()}>{submitting ? 'Sending...' : myClaim?.status === 'more_info_requested' ? 'Send details' : 'Submit claim'}</button></div></form></section></div>}
    {abuseOpen && <div className="modal-backdrop" onMouseDown={() => setAbuseOpen(false)}><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="abuse-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="abuse-title">Report this post</h2><form className="form-stack" onSubmit={submitAbuseReport}><label>Reason<select required value={abuseReason} onChange={(event) => setAbuseReason(event.target.value)}><option value="">Choose a reason</option><option value="scam">Scam or misleading</option><option value="spam">Spam</option><option value="prohibited_item">Prohibited item</option><option value="personal_information">Personal information shown</option><option value="other">Other concern</option></select></label><div className="report-modal-actions"><button type="button" className="secondary-button" onClick={() => setAbuseOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!abuseReason}>Send report</button></div></form></section></div>}
  </section>
}

export default LostFoundDetails
