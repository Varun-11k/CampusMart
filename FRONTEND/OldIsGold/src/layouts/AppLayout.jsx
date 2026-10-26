import { NavLink, Outlet, Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import NotificationBell from '../components/NotificationBell'
import PwaInstallControl from '../components/PwaInstallControl'
import NetworkStatusBanner from '../components/NetworkStatusBanner'
import PageMetadata from '../components/PageMetadata'
import { authSecurityApi } from '../services/api'

const campusLinks = [
  ['/campus-feed', "What's Going On?"], ['/campus-feed/reels', 'Reels'], ['/campus-exchange', 'Campus Exchange'], ['/lost-found', 'Lost & Found'],
  ['/campus-voices', 'Campus Voices'], ['/campus-voices#polls', 'Polls'], ['/resources', 'Resources'],
  ['/challenges', 'Challenges'], ['/deals', 'Deals'], ['/home#weekly-campus', 'Weekly Campus'],
]
const profileLinks = [
  ['/profile', 'Profile'], ['/wishlist', 'Wishlist'], ['/notifications', 'Notifications'],
  ['/settings', 'Account settings'], ['/profile#listings', 'My Listings'], ['/resources/my-resources', 'My Resources'],
  ['/campus-feed/mine', 'My Feed Posts'], ['/campus-feed/saved', 'Saved Posts'], ['/campus-exchange/my-exchanges', 'My Exchanges'], ['/lost-found/my-reports', 'My Reports'],
]

function closeMenus() {
  document.querySelectorAll('.site-header details[open], .mobile-nav details[open]').forEach((menu) => { menu.open = false })
}

function AppLayout() {
  const { user, token, logout, updateCurrentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [themeOverride, setThemeOverride] = useState(null)
  const theme = themeOverride || user?.themePreference || localStorage.getItem('campusmart_theme') || 'light'
  const [themeError, setThemeError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('campusmart_theme', theme)
  }, [theme])

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setThemeOverride(nextTheme)
    setThemeError('')
    if (!user || !token) return
    try {
      const result = await authSecurityApi.updateProfile(token, { themePreference: nextTheme })
      updateCurrentUser(result.user)
      setThemeOverride(null)
    } catch (error) {
      setThemeError(error.message || 'Theme preference could not be saved.')
    }
  }

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '')
    closeMenus()
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenus()
    }
    const handlePointerDown = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.site-header details, .mobile-nav details')) closeMenus()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])
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
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span>
      </button>
      {themeError && <span className="theme-save-error" role="alert">{themeError}</span>}
      <div className="header-actions">
        {user ? <><NavLink className="messages-link" to="/messages">Messages</NavLink><details className="nav-menu profile-menu"><summary>{user.name?.split(' ')[0] || 'Profile'} <span className="profile-avatar" aria-hidden="true">{user.profileImage ? <img src={user.profileImage} alt="" /> : (user.name || 'S').slice(0, 1).toUpperCase()}</span></summary><div className="nav-dropdown nav-dropdown-right" onClick={closeMenus}>{profileLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}{user.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}<button type="button" onClick={logout}>Log out</button></div></details><span className="header-bell"><NotificationBell /></span></> : <><NavLink to="/login">Log in</NavLink><NavLink className="nav-button" to="/register">Create Account</NavLink></>}
      </div>
    </header>
    <main className="site-main">
      <PageMetadata />
      <div className="site-status-row"><NetworkStatusBanner /><PwaInstallControl /></div>
      <Outlet />
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/home"><span aria-hidden="true">⌂</span><small>Home</small></NavLink>
      <NavLink to="/marketplace"><span aria-hidden="true">⌕</span><small>Market</small></NavLink>
      <details className="mobile-campus-menu"><summary><span aria-hidden="true">✳</span><small>Campus</small></summary><div className="mobile-menu-sheet" onClick={closeMenus}>{campusLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div></details>
      <NavLink to="/campus-feed"><span aria-hidden="true">☰</span><small>Feed</small></NavLink>
      <details className="mobile-profile-menu"><summary><span aria-hidden="true">◉</span><small>Profile</small></summary><div className="mobile-menu-sheet mobile-menu-sheet-right" onClick={closeMenus}>{user ? <>{profileLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}<Link to="/messages">Messages</Link>{user.role === 'admin' && <Link to="/admin">Admin</Link>}<button type="button" onClick={logout}>Log out</button></> : <><Link to="/login">Log in</Link><Link to="/register">Join CampusMart</Link></>}</div></details>
    </nav>
    <footer className="site-footer">
      <div className="footer-brand">
        <NavLink className="brand" to="/home"><span className="brand-mark" aria-hidden="true">C</span><span>Campus<span>Mart</span></span></NavLink>
        <p>Good finds. Better campus communities.</p>
      </div>
      <div className="footer-column"><strong>Explore</strong><NavLink to="/marketplace">Marketplace</NavLink><NavLink to="/lost-found">Lost &amp; Found</NavLink><NavLink to="/campus-voices">Campus Voices</NavLink><NavLink to="/resources">Study resources</NavLink></div>
      <div className="footer-column"><strong>Your account</strong><NavLink to="/sell">Sell an item</NavLink><NavLink to="/messages">Messages</NavLink><NavLink to="/wishlist">Wishlist</NavLink><NavLink to="/profile">Profile</NavLink><NavLink to="/settings">Account settings</NavLink></div>
      <div className="footer-column"><strong>Help &amp; policies</strong><NavLink to="/campus-ai">Campus AI support</NavLink><NavLink to="/privacy">Privacy</NavLink><NavLink to="/terms">Terms</NavLink><NavLink to="/notifications">Notifications</NavLink></div>
    </footer>
  </div>
}

export default AppLayout
