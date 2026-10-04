import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { engagementApi } from '../services/api'

function CampusChallenges() {
  const { token } = useAuth(); const [challenges, setChallenges] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const refresh = () => engagementApi.challenges(token).then((data) => setChallenges(data.challenges || [])).catch((requestError) => setError(requestError.message))
  useEffect(() => { let active = true; engagementApi.challenges(token).then((data) => active && setChallenges(data.challenges || [])).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false)); return () => { active = false } }, [token])
  const claim = async (challenge) => { try { const result = await engagementApi.claimChallenge(token, challenge._id); setError(`Added ${result.points} points.`); await refresh() } catch (requestError) { setError(requestError.message) } }
  return <section className="resources-page"><div className="resources-heading"><div><p className="eyebrow">Contribute through real campus activity</p><h1>Campus Challenges</h1><p>Progress comes from verified CampusMart actions during each challenge.</p></div></div>{error && <p className="form-error" role="status">{error}</p>}{loading ? <div className="empty-state">Loading challenges...</div> : challenges.length ? <div className="resource-grid">{challenges.map((challenge) => <article className="resource-card" key={challenge._id}><span className="resource-type">{challenge.type.replace('_', ' ')}</span><h2>{challenge.title}</h2><p>{challenge.description}</p><progress max={challenge.target} value={Math.min(challenge.progress, challenge.target)} /><p>{Math.min(challenge.progress, challenge.target)} / {challenge.target} completed</p><p>🏅 Reward: {challenge.rewardPoints} Campus Points</p><p>Ends {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(challenge.endDate))}</p>{token && challenge.progress >= challenge.target && <button className="primary-button" onClick={() => claim(challenge)}>Claim reward</button>}</article>)}</div> : <div className="empty-state">No active challenges available. Check back soon.</div>}{!token && <p>Log in to see your verified progress. <Link to="/login">Log in</Link></p>}</section>
}

export default CampusChallenges
