import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusFeedApi } from '../services/api'
import '../campusFeed.css'

const categories = [
  ['general', 'General'], ['update', 'Update'], ['meme', 'Meme'], ['food', 'Food'], ['sports', 'Sports'],
  ['study', 'Study'], ['event', 'Event'], ['club', 'Club'], ['marketplace', 'Marketplace'], ['lostfound', 'Lost & Found'], ['question', 'Question'],
]

const tabs = [
  { value: 'latest', label: 'Latest' },
  { value: 'forYou', label: 'For You' },
  { value: 'following', label: 'Following' },
  { value: 'trending', label: 'Trending' },
  { value: 'reels', label: 'Reels' },
]

const typeFilters = [
  { value: '', label: 'All' }, { value: 'text', label: 'Text' }, { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' }, { value: 'meme', label: 'Memes' }, { value: 'event', label: 'Events' },
  { value: 'food', label: 'Food' }, { value: 'sports', label: 'Sports' }, { value: 'study', label: 'Study' },
]

function CampusFeed() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname.endsWith('/saved') ? 'saved' : location.pathname.endsWith('/mine') ? 'mine' : 'feed'
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(searchParams.get('tab') || 'latest')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [hashtags, setHashtags] = useState([])
  const [commentsByPost, setCommentsByPost] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [openComments, setOpenComments] = useState({})

  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [composerHashtags, setComposerHashtags] = useState('')
  const [campusTag, setCampusTag] = useState(user?.college || '')
  const [visibility, setVisibility] = useState('campus')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [showPoll, setShowPoll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [composerError, setComposerError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => () => {
    previews.forEach(({ url }) => URL.revokeObjectURL(url))
  }, [previews])

  const loadPosts = useCallback(async (targetPage = 1) => {
    setLoading(true); setError('')
    try {
      const params = { page: targetPage, limit: 12, tab, search: debouncedSearch }
      if (typeFilter) {
        if (['meme', 'event', 'food', 'sports', 'study'].includes(typeFilter)) params.category = typeFilter
        else params.type = typeFilter
      }
      if (searchParams.get('hashtag')) params.hashtag = searchParams.get('hashtag')
      let data
      if (mode === 'saved') data = await campusFeedApi.saved(token, targetPage)
      else if (mode === 'mine') data = await campusFeedApi.mine(token, targetPage)
      else data = tab === 'reels'
        ? await campusFeedApi.reels(params, token)
        : await campusFeedApi.list(params, token)
      setPosts(data.posts || [])
      setPages(data.pagination?.pages || 1)
      setPage(targetPage)
    } catch (requestError) {
      setError(requestError.message || 'Could not load feed')
    } finally {
      setLoading(false)
    }
  }, [mode, tab, typeFilter, debouncedSearch, token, searchParams])

  useEffect(() => { loadPosts(1) }, [loadPosts])
  useEffect(() => {
    campusFeedApi.trendingHashtags().then((data) => setHashtags(data.hashtags || [])).catch(() => {})
  }, [])

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (tab && tab !== 'latest') next.set('tab', tab); else next.delete('tab')
      if (typeFilter) next.set('type', typeFilter); else next.delete('type')
      if (search) next.set('search', search); else next.delete('search')
      return next
    }, { replace: true })
  }, [tab, typeFilter, search, setSearchParams])

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return
    const next = [...files, ...selected].slice(0, 6)
    setFiles(next)
    setPreviews(next.map((file) => ({ file, url: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') })))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index) => {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    setPreviews(next.map((file) => ({ file, url: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') })))
  }

  const resetComposer = () => {
    setContent(''); setCategory('general'); setComposerHashtags(''); setCampusTag(user?.college || '')
    setVisibility('campus'); setFiles([]); setPreviews([]); setPollQuestion(''); setPollOptions(['', '']); setShowPoll(false); setComposerError('')
  }

  const submitPost = async (event) => {
    event.preventDefault()
    if (!token) return navigate('/login', { state: { from: '/campus-feed' } })
    if (!content.trim() && files.length === 0 && !showPoll) {
      setComposerError('Add text, media, or a poll before posting.'); return
    }
    setSubmitting(true); setComposerError('')
    try {
      const payload = {
        content: content.trim(),
        category,
        hashtags: composerHashtags.trim(),
        campusTag: campusTag.trim(),
        visibility,
      }
      if (showPoll) payload.poll = { question: pollQuestion.trim(), options: pollOptions.map((v) => v.trim()).filter(Boolean) }
      await campusFeedApi.create(token, payload, files)
      resetComposer()
      await loadPosts(1)
    } catch (requestError) {
      setComposerError(requestError.message || 'Could not create post')
    } finally {
      setSubmitting(false)
    }
  }

  const likePost = async (post) => {
    if (!token) return navigate('/login', { state: { from: '/campus-feed' } })
    setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: !item.likedByMe, likeCount: item.likedByMe ? item.likeCount - 1 : item.likeCount + 1 } : item))
    try {
      const result = await campusFeedApi.like(token, post._id)
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: result.likedByMe, likeCount: result.likeCount } : item))
    } catch {
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: post.likedByMe, likeCount: post.likeCount } : item))
    }
  }

  const savePost = async (post) => {
    if (!token) return navigate('/login', { state: { from: '/campus-feed' } })
    setPosts((current) => current.map((item) => item._id === post._id ? { ...item, savedByMe: !item.savedByMe, saveCount: item.savedByMe ? item.saveCount - 1 : item.saveCount + 1 } : item))
    try {
      const result = await campusFeedApi.save(token, post._id)
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, savedByMe: result.savedByMe, saveCount: result.saveCount } : item))
    } catch {
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, savedByMe: post.savedByMe, saveCount: post.saveCount } : item))
    }
  }
  const toggleComments = async (postId) => {
    setOpenComments((current) => ({ ...current, [postId]: !current[postId] }))
    if (!commentsByPost[postId]) {
      try {
        const data = await campusFeedApi.comments(postId, { limit: 30 }, token)
        setCommentsByPost((current) => ({ ...current, [postId]: data.comments || [] }))
      } catch {}
    }
  }

  const submitComment = async (postId) => {
    const draft = (commentDrafts[postId] || '').trim()
    if (!draft || !token) return
    try {
      const data = await campusFeedApi.addComment(token, postId, { content: draft })
      setCommentsByPost((current) => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }))
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setPosts((current) => current.map((item) => item._id === postId ? { ...item, commentCount: (item.commentCount || 0) + 1 } : item))
    } catch (requestError) {
      setError(requestError.message || 'Could not comment')
    }
  }

  const deleteComment = async (postId, commentId) => {
    if (!token) return
    try {
      await campusFeedApi.deleteComment(token, commentId)
      setCommentsByPost((current) => ({ ...current, [postId]: (current[postId] || []).filter((item) => item._id !== commentId) }))
      setPosts((current) => current.map((item) => item._id === postId ? { ...item, commentCount: Math.max(0, (item.commentCount || 1) - 1) } : item))
    } catch {}
  }

  const votePoll = async (post, optionId) => {
    if (!token) return navigate('/login', { state: { from: '/campus-feed' } })
    try {
      const data = await campusFeedApi.votePoll(token, post._id, optionId)
      setPosts((current) => current.map((item) => item._id === post._id ? data.post : item))
    } catch {}
  }

  const sharePost = async (post) => {
    const url = `${window.location.origin}/campus-feed?post=${post._id}`
    try {
      if (navigator.share) await navigator.share({ title: 'CampusMart post', url })
      else { await navigator.clipboard.writeText(url); alert('Post link copied') }
    } catch {}
  }

  const deletePost = async (post) => {
    if (!token) return
    if (!window.confirm('Delete this post?')) return
    try {
      await campusFeedApi.remove(token, post._id)
      setPosts((current) => current.filter((item) => item._id !== post._id))
    } catch {}
  }

  const visiblePosts = useMemo(() => posts, [posts])
  return (
    <section className="campus-feed-page">
      <div className="campus-feed-header">
        <div>
          <p className="eyebrow">Campus community</p>
          <h1>{mode === 'saved' ? 'Saved Posts' : mode === 'mine' ? 'My Posts' : "What's Going On?"}</h1>
          <p>Share updates, photos, videos, memes, and campus moments with your college community.</p>
        </div>
        <div className="campus-feed-header-actions">
          <Link className="secondary-button" to="/campus-feed/saved">Saved</Link>
          <Link className="secondary-button" to="/campus-feed/mine">My Posts</Link>
          <Link className="secondary-button" to="/campus-feed/reels">Reels</Link>
        </div>
      </div>

      {user && token && mode === 'feed' ? (
        <form className="feed-composer" onSubmit={submitPost}>
          <div className="composer-top">
            <div className="composer-avatar">{user.profileImage ? <img src={user.profileImage} alt="" /> : (user.name || 'S').slice(0, 1).toUpperCase()}</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What's happening on campus?" rows={3} maxLength={3000} />
          </div>
          {previews.length > 0 && (
            <div className="composer-previews">
              {previews.map((preview, index) => (
                <div key={index} className="composer-preview">
                  {preview.isVideo ? <video src={preview.url} muted /> : <img src={preview.url} alt="" />}
                  <button type="button" onClick={() => removeFile(index)} aria-label="Remove media">×</button>
                </div>
              ))}
            </div>
          )}
          {showPoll && (
            <div className="composer-poll">
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question (optional)" />
              {pollOptions.map((option, index) => (
                <input key={index} value={option} onChange={(e) => { const next = [...pollOptions]; next[index] = e.target.value; setPollOptions(next) }} placeholder={`Option ${index + 1}`} />
              ))}
              {pollOptions.length < 6 && <button type="button" className="text-button" onClick={() => setPollOptions([...pollOptions, ''])}>Add option</button>}
            </div>
          )}
          <div className="composer-row">
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={composerHashtags} onChange={(e) => setComposerHashtags(e.target.value)} placeholder="#hashtags" />
            <input value={campusTag} onChange={(e) => setCampusTag(e.target.value)} placeholder="Campus tag" />
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Visibility">
              <option value="campus">Campus</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="composer-actions">
            <label className="composer-upload">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} />
              📎 Media
            </label>
            <button type="button" className="text-button" onClick={() => setShowPoll((value) => !value)}>{showPoll ? 'Remove poll' : 'Add poll'}</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Posting...' : 'Post'}</button>
          </div>
          {composerError && <p className="form-error" role="alert">{composerError}</p>}
        </form>
      ) : (
        <div className="feed-signin-prompt">
          <p>Sign in to share what's happening on campus.</p>
          <Link className="primary-button" to="/login">Log in</Link>
        </div>
      )}

      <div className="feed-tabs" role="tablist" aria-label="Feed tabs">
        {tabs.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} onClick={() => { setTab(item.value); setPage(1) }}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="feed-toolbar">
        <div className="type-filters">
          {typeFilters.map((item) => (
            <button key={item.value || 'all'} type="button" className={typeFilter === item.value ? 'is-active' : ''} onClick={() => { setTypeFilter(item.value); setPage(1) }}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="feed-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search posts, hashtags..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </label>
      </div>

      {hashtags.length > 0 && (
        <div className="trending-hashtags">
          {hashtags.map((item) => (
            <button key={item.tag} type="button" className="hashtag-chip" onClick={() => { setSearch(`#${item.tag}`); setPage(1) }}>
              #{item.tag} <span>{item.count}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="voice-error" role="alert">{error} <button type="button" onClick={() => loadPosts(page)}>Retry</button></div>}
      {loading ? (
        <div className="feed-skeleton">Loading feed...</div>
      ) : visiblePosts.length === 0 ? (
        <div className="empty-state">No posts yet. Be the first to share what's going on!</div>
      ) : (
        <div className="feed-list">
          {visiblePosts.map((post) => (
            <article key={post._id} className="feed-card">
              <header className="feed-card-header">
                <div className="feed-author">
                  <div className="feed-avatar">{post.author?.profileImage ? <img src={post.author.profileImage} alt="" /> : (post.author?.name || 'S').slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{post.author?.name || 'Student'}</strong>
                    <small>{post.author?.college || 'Campus'} · {new Date(post.createdAt).toLocaleString()}</small>
                  </div>
                </div>
                <span className="feed-category">{post.category}</span>
              </header>
              {post.content && <p className="feed-content">{post.content}</p>}
              {post.hashtags?.length > 0 && (
                <div className="feed-hashtags">{post.hashtags.map((tag) => <button key={tag} type="button" onClick={() => { setSearch(`#${tag}`); setPage(1) }}>#{tag}</button>)}</div>
              )}
              {post.campusTag && <div className="feed-campus-tag">📍 {post.campusTag}</div>}
              {post.media?.length > 0 && (
                <div className={`feed-media ${post.media.length > 1 ? 'is-carousel' : ''}`}>
                  {post.media.map((item, index) => (
                    item.type === 'video'
                      ? <video key={index} src={item.url} controls preload="metadata" className="feed-video" />
                      : <img key={index} src={item.url} alt="" loading="lazy" />
                  ))}
                </div>
              )}
              {post.poll && (
                <div className="feed-poll">
                  {post.poll.question && <p className="poll-question">{post.poll.question}</p>}
                  {post.poll.options.map((option) => {
                    const totalVotes = post.poll.options.reduce((sum, item) => sum + item.votes, 0)
                    const percent = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0
                    return (
                      <button key={option._id} type="button" className={`poll-option ${option.votedByMe ? 'is-voted' : ''}`} onClick={() => votePoll(post, option._id)}>
                        <span>{option.text}</span>
                        <span className="poll-bar" style={{ width: `${percent}%` }} />
                        <small>{percent}%</small>
                      </button>
                    )
                  })}
                </div>
              )}
              <footer className="feed-card-footer">
                <button type="button" onClick={() => likePost(post)}>{post.likedByMe ? '♥' : '♡'} {post.likeCount}</button>
                <button type="button" onClick={() => toggleComments(post._id)}>💬 {post.commentCount}</button>
                <button type="button" onClick={() => savePost(post)}>{post.savedByMe ? '★' : '☆'} {post.saveCount}</button>
                <button type="button" onClick={() => sharePost(post)}>↗ Share</button>
                {post.isMine && <button type="button" onClick={() => navigate(`/campus-feed/edit/${post._id}`)}>Edit</button>}
                {post.isMine && <button type="button" onClick={() => deletePost(post)}>Delete</button>}
                <button type="button" onClick={() => {
                  const reason = window.prompt('Report reason: spam, harassment, inappropriate_content, scam, personal_information, other')
                  if (reason && token) campusFeedApi.reportPost(token, post._id, { reason }).catch(() => {})
                }}>Report</button>
              </footer>
              {openComments[post._id] && (
                <div className="feed-comments">
                  {(commentsByPost[post._id] || []).map((comment) => (
                    <div key={comment._id} className="feed-comment">
                      <div className="feed-avatar small">{comment.author?.profileImage ? <img src={comment.author.profileImage} alt="" /> : (comment.author?.name || 'S').slice(0, 1).toUpperCase()}</div>
                      <div className="comment-body">
                        <strong>{comment.author?.name || 'Student'}</strong>
                        <p>{comment.content}</p>
                        <div className="comment-actions">
                          <button type="button" onClick={async () => { if (!token) return; await campusFeedApi.likeComment(token, comment._id); const data = await campusFeedApi.comments(post._id, { limit: 30 }, token); setCommentsByPost((c) => ({ ...c, [post._id]: data.comments })) }}>♥ {comment.likeCount}</button>
                          {comment.isMine && <button type="button" onClick={() => deleteComment(post._id, comment._id)}>Delete</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {token && (
                    <div className="comment-composer">
                      <input value={commentDrafts[post._id] || ''} onChange={(e) => setCommentDrafts((current) => ({ ...current, [post._id]: e.target.value }))} placeholder="Write a comment..." maxLength={1000} />
                      <button type="button" onClick={() => submitComment(post._id)}>Send</button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="feed-pagination">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => loadPosts(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="secondary-button" type="button" disabled={page >= pages} onClick={() => loadPosts(page + 1)}>Next</button>
        </div>
      )}
    </section>
  )
}

export default CampusFeed
