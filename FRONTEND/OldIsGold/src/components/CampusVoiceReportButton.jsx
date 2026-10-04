import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { reportApi } from '../services/api'

const reasons = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['inappropriate_content', 'Inappropriate content'],
  ['personal_information', 'Personal information'],
  ['other', 'Other'],
]

function CampusVoiceReportButton({ postId }) {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!user || !token) return navigate('/login', { state: { from: '/campus-voices' } })
    setSending(true); setError('')
    try {
      await reportApi.create(token, { voicePostId: postId, reason, description })
      setOpen(false); setReason(''); setDescription('')
    } catch (requestError) { setError(requestError.message) } finally { setSending(false) }
  }

  return <>
    <button type="button" className="voice-action-button" onClick={() => user && token ? setOpen(true) : navigate('/login', { state: { from: '/campus-voices' } })}>Report</button>
    {open && <div className="modal-backdrop" onMouseDown={() => !sending && setOpen(false)}><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby={`voice-report-${postId}`} onMouseDown={(event) => event.stopPropagation()}>
      <p className="eyebrow">Community safety</p><h2 id={`voice-report-${postId}`}>Report this post</h2>
      <form className="form-stack" onSubmit={submit}><label>Reason<select required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Choose a reason</option>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Additional details (optional)<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="report-modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={sending}>Cancel</button><button type="submit" className="primary-button" disabled={sending || !reason}>{sending ? 'Submitting...' : 'Submit report'}</button></div>
      </form>
    </section></div>}
  </>
}

export default CampusVoiceReportButton
