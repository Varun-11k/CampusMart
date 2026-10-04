import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusExchangeApi, chatApi } from '../services/api'

const reasons = [['spam', 'Spam'], ['prohibited_item', 'Prohibited item'], ['inappropriate_content', 'Inappropriate content'], ['incorrect_information', 'Incorrect information'], ['other', 'Other']]
const displayDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))

function CampusExchangeDetails() {
  const { id } = useParams(); const navigate = useNavigate(); const { user, token } = useAuth()
  const [exchange, setExchange] = useState(null); const [requests, setRequests] = useState([])
  const [message, setMessage] = useState(''); const [proposal, setProposal] = useState(''); const [matches, setMatches] = useState([]); const [reason, setReason] = useState('spam'); const [reportDetails, setReportDetails] = useState('')
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [reporting, setReporting] = useState(false)
  const reload = useCallback(async () => {
    const data = await campusExchangeApi.get(id, token)
    setExchange(data.exchange)
    const matchData = await campusExchangeApi.matches(id).catch(() => ({ matches: [] }))
    setMatches(matchData.matches || [])
    if (data.exchange.isMine) {
      const requestData = await campusExchangeApi.requests(token, id)
      setRequests(requestData.requests || [])
    }
  }, [id, token])
  useEffect(() => { let active = true; setLoading(true); setError(''); campusExchangeApi.get(id, token).then(async (data) => {
    if (!active) return
    setExchange(data.exchange)
    if (data.exchange.isMine && token) { const requestData = await campusExchangeApi.requests(token, id); if (active) setRequests(requestData.requests || []) }
    const matchData = await campusExchangeApi.matches(id).catch(() => ({ matches: [] })); if (active) setMatches(matchData.matches || [])
  }).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false)); return () => { active = false } }, [id, token])
  const run = async (key, action) => { setBusy(key); setError(''); try { await action(); await reload() } catch (requestError) { setError(requestError.message) } finally { setBusy('') } }
  const contact = () => run('chat', async () => { if (!token) return navigate('/login'); const result = await chatApi.startCampusExchangeConversation(token, id); navigate(`/messages/${result.conversation._id}`) })
  const request = (event) => { event.preventDefault(); if (!token) return navigate('/login'); if (!message.trim()) return setError('Add a short message with your exchange offer.'); run('request', async () => { await campusExchangeApi.request(token, id, message.trim(), proposal.trim()); setMessage(''); setProposal('') }) }
  const report = (event) => { event.preventDefault(); if (!token) return navigate('/login'); run('report', () => campusExchangeApi.report(token, id, { reason, description: reportDetails })) }
  const manageRequest = (requestId, action) => run(requestId, () => action === 'accept' ? campusExchangeApi.accept(token, requestId) : campusExchangeApi.reject(token, requestId))
  if (loading) return <section className="placeholder">Loading exchange...</section>
  if (error && !exchange) return <section className="placeholder" role="alert"><strong>Unable to load exchange</strong><span>{error}</span><Link to="/campus-exchange">Back to Campus Exchange</Link></section>
  if (!exchange) return <Navigate to="/campus-exchange" replace />
  const isMine = Boolean(exchange.isMine)
  return <section className="resource-detail-page exchange-detail-page"><Link className="text-link" to="/campus-exchange">← Back to Campus Exchange</Link><article className="resource-detail exchange-detail"><span className={`resource-type resource-status-${exchange.status}`}>{exchange.status}</span><h1>{exchange.title}</h1><div className="exchange-detail-grid"><div className="exchange-detail-images">{exchange.images?.length ? exchange.images.map((image) => <img src={image} alt={exchange.title} key={image} />) : <div className="exchange-no-image">⇄</div>}</div><div className="exchange-detail-info"><p><strong>Offering</strong><br />{exchange.offeredItem}</p><p><strong>Looking for</strong><br />{exchange.wantedItem}</p><p>{exchange.description || 'No additional description.'}</p><p>{exchange.category} · {exchange.condition}</p><p>{exchange.location}</p><p>{exchange.owner?.college || 'Campus student'} · Shared {displayDate(exchange.createdAt)}</p></div></div>
      <div className="resource-page-actions exchange-detail-actions">{isMine ? <>{exchange.status === 'active' && <><Link className="secondary-button" to={`/campus-exchange/create?id=${id}`}>Edit</Link><button className="secondary-button" disabled={Boolean(busy)} onClick={() => run('close', () => campusExchangeApi.close(token, id))}>Close</button><button className="primary-button" disabled={Boolean(busy)} onClick={() => run('exchanged', () => campusExchangeApi.exchanged(token, id))}>Mark as Exchanged</button></>}</> : exchange.status === 'active' && <><button className="secondary-button" disabled={Boolean(busy)} onClick={contact}>Discuss Exchange</button>{!exchange.myRequest && <button className="primary-button" onClick={() => document.getElementById('exchange-request-message')?.focus()}>Request Exchange</button>}<button className="secondary-button" onClick={() => setReporting((value) => !value)}>Report</button></>}</div>
      {!isMine && exchange.status === 'active' && !exchange.myRequest && <form className="exchange-request-form" onSubmit={request}><label htmlFor="exchange-request-message">Why would you like to exchange? (max 1000 characters)</label><textarea id="exchange-request-message" maxLength={1000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} />{exchange.openToOffers && <label htmlFor="exchange-proposal">Alternative item offer (optional, max 200 characters)<input id="exchange-proposal" maxLength={200} value={proposal} onChange={(event) => setProposal(event.target.value)} placeholder="Computer Networks textbook" /></label>}<button className="primary-button" disabled={Boolean(busy) || !message.trim()}>{busy === 'request' ? 'Sending...' : 'Send Exchange Request'}</button></form>}
      {exchange.myRequest && <div className="exchange-my-request"><strong>Your request: {exchange.myRequest.status}</strong>{exchange.myRequest.status === 'pending' && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => run('cancel', () => campusExchangeApi.cancel(token, exchange.myRequest._id))}>Cancel Request</button>}</div>}
      {reporting && <form className="resource-report-form" onSubmit={report}><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Details<textarea maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></label><button className="primary-button" disabled={Boolean(busy)}>Submit Report</button></form>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {isMine && <section className="exchange-requests"><h2>Exchange Requests <span>({requests.length})</span></h2>{requests.length ? requests.map((entry) => <article className="exchange-request-card" key={entry._id}><div className="exchange-request-person">{entry.requester?.profileImage && <img src={entry.requester.profileImage} alt="" />}<div><strong>{entry.requester?.name || 'Campus student'}</strong><span>{entry.requester?.college || 'Campus student'} · {displayDate(entry.createdAt)}</span></div><span className="resource-type">{entry.status}</span></div><p>{entry.message}</p>{entry.proposal && <p><strong>Alternative offer:</strong> {entry.proposal}</p>}{entry.status === 'pending' && exchange.status === 'active' && <div className="resource-page-actions"><button className="primary-button" disabled={Boolean(busy)} onClick={() => manageRequest(entry._id, 'accept')}>{busy === entry._id ? 'Saving...' : 'Accept'}</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => manageRequest(entry._id, 'reject')}>Reject</button></div>}</article>) : <p>No exchange requests yet.</p>}</section>}
      {!isMine && matches.length > 0 && <section className="exchange-requests"><h2>Potential Exchange Matches</h2><p>These are active listings that may align with the items you offered and want.</p><div className="resource-grid exchange-grid">{matches.map((match) => <article className="resource-card exchange-card" key={match._id}><h3><Link to={`/campus-exchange/${match._id}`}>{match.title}</Link></h3><p><strong>Offering:</strong> {match.offeredItem}</p><p><strong>Looking for:</strong> {match.wantedItem}</p><p>{match.location}</p></article>)}</div></section>}
    </article></section>
}

export default CampusExchangeDetails
