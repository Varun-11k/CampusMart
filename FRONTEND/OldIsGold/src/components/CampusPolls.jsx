import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { engagementApi } from '../services/api'

function CampusPolls() {
  const { user, token } = useAuth()
  const [polls, setPolls] = useState([]); const [question, setQuestion] = useState(''); const [options, setOptions] = useState(['', '']); const [selected, setSelected] = useState({}); const [error, setError] = useState('')
  const refresh = () => engagementApi.polls(token).then((data) => setPolls(data.polls || [])).catch((requestError) => setError(requestError.message))
  useEffect(() => { refresh() }, [token])
  const vote = async (poll) => { if (!token) return setError('Log in to vote.'); try { const data = await engagementApi.votePoll(token, poll._id, Number(selected[poll._id])); setPolls((current) => current.map((item) => item._id === poll._id ? data.poll : item)); setError('') } catch (requestError) { setError(requestError.message) } }
  const create = async (event) => { event.preventDefault(); if (!token) return setError('Log in to create a poll.'); try { await engagementApi.createPoll(token, { question, options: options.filter((item) => item.trim()) }); setQuestion(''); setOptions(['', '']); await refresh() } catch (requestError) { setError(requestError.message) } }
  return <section className="campus-polls" id="polls"><div className="campus-ai-section-heading"><div><p className="eyebrow">Community questions</p><h2>Campus Polls</h2></div></div>{error && <p className="form-error" role="alert">{error}</p>}
    {token && <form className="campus-poll-create" onSubmit={create}><label>Ask your campus<input maxLength={200} value={question} onChange={(event) => setQuestion(event.target.value)} required placeholder="Which campus facility needs improvement?" /></label>{options.map((option, index) => <label key={index}>Option {index + 1}<input maxLength={80} value={option} onChange={(event) => setOptions((current) => current.map((value, position) => position === index ? event.target.value : value))} required /></label>)}{options.length < 6 && <button type="button" className="secondary-button" onClick={() => setOptions((current) => [...current, ''])}>Add option</button>}<button className="primary-button" type="submit">Create Poll</button></form>}
    {polls.length ? <div className="resource-grid">{polls.map((poll) => <article className="resource-card campus-poll-card" key={poll._id}><h3>{poll.question}</h3>{poll.voted ? poll.options.map((option, index) => { const percent = poll.totalVotes ? Math.round(poll.counts[index] / poll.totalVotes * 100) : 0; return <div className="poll-result" key={option}><span>{option} â€” {percent}%</span><progress max="100" value={percent} /></div> }) : <><select aria-label="Select a poll answer" value={selected[poll._id] ?? ''} onChange={(event) => setSelected((current) => ({ ...current, [poll._id]: event.target.value }))}><option value="">Choose an answer</option>{poll.options.map((option, index) => <option value={index} key={option}>{option}</option>)}</select><button className="secondary-button" type="button" disabled={selected[poll._id] === undefined} onClick={() => vote(poll)}>Vote</button></>}<small>{poll.totalVotes} votes</small>{poll.isMine && <button type="button" className="text-link" onClick={async () => { try { await engagementApi.closePoll(token, poll._id); await refresh() } catch (requestError) { setError(requestError.message) } }}>Close poll</button>}</article>)}</div> : <div className="empty-state">No active campus polls yet.</div>}
  </section>
}

export default CampusPolls

