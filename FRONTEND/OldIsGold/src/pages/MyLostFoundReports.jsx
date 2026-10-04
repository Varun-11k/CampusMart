import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { lostFoundApi } from '../services/api'

const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))

function MyLostFoundReports() {
  const { user, token, loading: authLoading } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => lostFoundApi.myReports(token).then((data) => setReports(data.reports || [])), [token])
  useEffect(() => { if (!token) return undefined; let active = true; setLoading(true); load().catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [load, token])
  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: '/lost-found/my-reports' }} />

  const remove = async (report) => {
    if (!window.confirm(`Delete your report for “${report.title}”?`)) return
    try { await lostFoundApi.remove(token, report._id); await load() } catch (e) { setError(e.message) }
  }
  const group = (type) => reports.filter((report) => report.type === type)
  const renderGroup = (type, title) => <section className="my-report-group"><div className="section-heading"><div><p className="eyebrow">Your activity</p><h2>{title}</h2></div></div>{group(type).length ? <div className="my-report-list">{group(type).map((report) => <article className="my-report-row" key={report._id}><div className="my-report-thumb">{report.images?.[0] ? <img src={report.images[0]} alt="" /> : <span aria-hidden="true">{type === 'lost' ? '🔎' : '📦'}</span>}</div><div className="my-report-info"><Link to={`/lost-found/${report._id}`}><strong>{report.title}</strong></Link><span>{dateLabel(report.date)} · {report.location}</span><span className={`lost-found-status status-${report.status}`}>{report.status}</span><span>{report.claimCount || 0} {(report.claimCount || 0) === 1 ? 'claim' : 'claims'}</span></div><div className="my-report-actions"><Link className="text-link" to={`/lost-found/${report._id}`}>View claims</Link>{report.status === 'active' && <Link className="text-link" to={`/lost-found/report?id=${report._id}`}>Edit</Link>}{['active', 'claimed'].includes(report.status) && <button className="text-link-button" type="button" onClick={async () => { try { await lostFoundApi.returned(token, report._id); await load() } catch (e) { setError(e.message) } }}>Mark returned</button>}{report.status === 'active' && <button className="text-link-button danger-text" type="button" onClick={() => remove(report)}>Delete</button>}</div></article>)}</div> : <div className="empty-state">No {type} reports yet.</div>}</section>

  return <section className="my-lost-found-page"><div className="lost-found-heading"><div><p className="eyebrow">Your Lost &amp; Found activity</p><h1>My reports</h1></div><Link className="primary-button" to="/lost-found">Browse reports</Link></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="empty-state">Loading your reports...</div> : <>{renderGroup('lost', 'My Lost Reports')}{renderGroup('found', 'My Found Reports')}</>}</section>
}

export default MyLostFoundReports
