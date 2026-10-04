import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import CampusVoiceCard from '../components/CampusVoiceCard'
import { campusVoiceApi } from '../services/api'
import CampusPolls from '../components/CampusPolls'

const tabs = [
  { value: '', label: 'All' },
  { value: 'confession', label: 'Confessions' },
  { value: 'question', label: 'Questions' },
  { value: 'suggestion', label: 'Suggestions' },
  { value: 'experience', label: 'Experiences' },
  { value: 'opinion', label: 'Opinions' },
]

function CampusVoices() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [search, setSearch] = useState('')
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [likePending, setLikePending] = useState('')
  const [sort, setSort] = useState('recent')
  const category = searchParams.get('category') || ''

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true); setError(false)
      campusVoiceApi.list({ category, search: search.trim(), sort, page, limit: 10 }, token).then((data) => {
        if (!active) return
        setPosts(data.posts || []); setPages(data.pagination?.pages || 1)
      }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    }, 180)
    return () => { active = false; clearTimeout(timer) }
  }, [category, page, search, sort, token])

  const chooseCategory = (value) => { setPage(1); setSearchParams(value ? { category: value } : {}) }
  const likePost = async (post) => {
    if (!token) return navigate('/login', { state: { from: '/campus-voices' } })
    setLikePending(post._id)
    try {
      const result = await campusVoiceApi.like(token, post._id)
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likeCount: result.likeCount, likedByMe: result.likedByMe } : item))
    } catch { setError(true) } finally { setLikePending('') }
  }

  return <section className="campus-voices-page"><div className="campus-voices-heading"><div><p className="eyebrow">Campus community</p><h1>Campus Voices</h1><p>Share your thoughts with your campus community.</p></div><div className="voice-page-actions"><Link className="secondary-button" to="/campus-voices/my-posts">My Posts</Link><Link className="primary-button" to="/campus-voices/create">Share Something</Link></div></div>
    <CampusPolls />
    <div className="voice-tabs" role="tablist" aria-label="Campus Voices category">{tabs.map((tab) => <button key={tab.value || 'all'} type="button" role="tab" aria-selected={category === tab.value} className={category === tab.value ? 'is-active' : ''} onClick={() => chooseCategory(tab.value)}>{tab.label}</button>)}</div>
    <label className="voice-sort">Sort posts<select value={sort} onChange={(event) => { setPage(1); setSort(event.target.value) }}><option value="recent">Most recent</option><option value="most_liked">Most discussed</option></select></label>
    <label className="voice-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search campus voices..." value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} /></label>
    {error && <div className="voice-error" role="alert">Something went wrong. Please try again.</div>}
    {loading ? <div className="empty-state">Loading Campus Voices...</div> : posts.length ? <div className="campus-voice-list">{posts.map((post) => <CampusVoiceCard key={post._id} post={post} onLike={likePost} likePending={likePending === post._id} />)}</div> : <div className="empty-state">{search || category ? 'No posts found.' : 'No campus voices yet.'}</div>}
    {pages > 1 && <div className="voice-pagination"><button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    {!user && <p className="voice-privacy-note">Posts are shared as Anonymous Student. Sign in to like, report, or share a post.</p>}
  </section>
}

export default CampusVoices
