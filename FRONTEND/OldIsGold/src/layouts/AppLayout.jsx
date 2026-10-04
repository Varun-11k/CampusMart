import { NavLink, Outlet, Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import NotificationBell from '../components/NotificationBell'

const campusLinks = [
  ['/campus-exchange', 'Campus Exchange'], ['/lost-found', 'Lost & Found'],
  ['/campus-voices', 'Campus Voices'], ['/campus-voices#polls', 'Polls'], ['/resources', 'Resources'],
  ['/challenges', 'Challenges'], ['/deals', 'Deals'], ['/home#weekly-campus', 'Weekly Campus'],
]
const profileLinks = [
  ['/profile', 'Profile'], ['/wishlist', 'Wishlist'], ['/notifications', 'Notifications'],
  ['/profile#listings', 'My Listings'], ['/resources/my-resources', 'My Resources'],
  ['/campus-exchange/my-exchanges', 'My Exchanges'], ['/lost-found/my-reports', 'My Reports'],
]

function AppLayout() {
  const closeMenus = () => document.querySelectorAll('.site-header details[open], .mobile-nav details[open]').forEach((menu) => { menu.open = false })
  const [search, setSearch] = useState('')
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => setSearch(new URLSearchParams(location.search).get('search') || ''), [location.search])
  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace')
  }

  return <div className="app-shell">
    <header className="site-header">
      <NavLink className="brand" to="/home" aria-label="CampusMart home"><span className="brand-mark" aria-hidden="true">C</span><span>Campus<span>Mart</span></span></NavLink>
      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink to="/home">Home</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <details className="nav-menu"><summary>Campus</summary><div className="nav-dropdown" onClick={closeMenus}>{campusLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div></details>
        <NavLink to="/campus-ai">AI</NavLink>
      </nav>
      <div className="header-search"><SearchBar value={search} onChange={setSearch} onKeyDown={handleSearchKeyDown} compact /></div>
      <div className="header-actions">
        {user ? <><NavLink className="messages-link" to="/messages">Messages</NavLink><details className="nav-menu profile-menu"><summary>{user.name?.split(' ')[0] || 'Profile'} <span className="profile-avatar" aria-hidden="true">{(user.name || 'S').slice(0, 1).toUpperCase()}</span></summary><div className="nav-dropdown nav-dropdown-right" onClick={closeMenus}>{profileLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}{user.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}<button type="button" onClick={logout}>Log out</button></div></details><span className="header-bell"><NotificationBell /></span></> : <><NavLink to="/login">Log in</NavLink><NavLink className="nav-button" to="/register">Join CampusMart</NavLink></>}
      </div>
    </header>
    <main className="site-main"><Outlet /></main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/home"><span aria-hidden="true">⌂</span><small>Home</small></NavLink>
      <NavLink to="/marketplace"><span aria-hidden="true">⌕</span><small>Market</small></NavLink>
      <details className="mobile-campus-menu"><summary><span aria-hidden="true">✳</span><small>Campus</small></summary><div className="mobile-menu-sheet" onClick={closeMenus}>{campusLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div></details>
      <NavLink to="/campus-ai"><span aria-hidden="true">✧</span><small>AI</small></NavLink>
      <details className="mobile-profile-menu"><summary><span aria-hidden="true">◉</span><small>Profile</small></summary><div className="mobile-menu-sheet mobile-menu-sheet-right" onClick={closeMenus}>{user ? <>{profileLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}<Link to="/messages">Messages</Link>{user.role === 'admin' && <Link to="/admin">Admin</Link>}<button type="button" onClick={logout}>Log out</button></> : <><Link to="/login">Log in</Link><Link to="/register">Join CampusMart</Link></>}</div></details>
    </nav>
    <footer className="site-footer"><div><NavLink className="brand" to="/home">Campus<span>Mart</span></NavLink><p>Good finds. Better campus communities.</p></div><div className="footer-links">{[...campusLinks.slice(0, 6), ['/messages', 'Messages'], ['/wishlist', 'Wishlist'], ['/notifications', 'Notifications'], ['/profile', 'Profile'], ...(user?.role === 'admin' ? [['/admin', 'Admin dashboard']] : [])].map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</div></footer>
  </div>
}

export default AppLayout

