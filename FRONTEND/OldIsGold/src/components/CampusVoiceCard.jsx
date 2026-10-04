import { Link } from 'react-router-dom'
import CampusVoiceReportButton from './CampusVoiceReportButton'

const labels = { confession: 'Confession', question: 'Question', suggestion: 'Suggestion', experience: 'Experience', opinion: 'Opinion' }
const formatDateTime = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function CampusVoiceCard({ post, onLike, likePending = false, showManage = false, onDelete }) {
  return <article className="campus-voice-card">
    <div className="campus-voice-card-header"><span className={`voice-category category-${post.category}`}>{labels[post.category] || post.category}</span>{showManage && post.status !== 'active' && <span className={`voice-status status-${post.status}`}>{post.status}</span>}</div>
    <Link className="campus-voice-content-link" to={`/campus-voices/${post._id}`}><p className="campus-voice-content">{post.content}</p></Link>
    <div className="campus-voice-meta"><span>{post.authorLabel || 'Anonymous Student'}</span><time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time></div>
    <div className="campus-voice-actions">{post.status === 'active' && <button type="button" className={`voice-action-button${post.likedByMe ? ' is-liked' : ''}`} onClick={() => onLike(post)} disabled={likePending}>{post.likedByMe ? '♥ Liked' : '♡ Like'} <span>{post.likeCount || 0}</span></button>}{!showManage && post.status === 'active' && <CampusVoiceReportButton postId={post._id} />}{showManage && post.status === 'active' && <Link className="voice-action-button" to={`/campus-voices/create?id=${post._id}`}>Edit</Link>}{showManage && onDelete && <button type="button" className="voice-action-button is-danger" onClick={() => onDelete(post)}>Delete</button>}</div>
  </article>
}

export default CampusVoiceCard
