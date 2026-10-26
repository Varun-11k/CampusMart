import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <section className="empty-state not-found-page" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">We couldn’t find that page</h1>
      <p>The link may be outdated, or the page may have moved.</p>
      <Link className="primary-button" to="/">Return to CampusMart</Link>
    </section>
  )
}

export default NotFound
