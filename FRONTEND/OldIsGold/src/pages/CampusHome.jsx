import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const sections = [
  { icon: '🛍️', title: 'Marketplace', description: 'Buy and sell useful finds with students nearby.', to: '/marketplace', theme: 'market' },
  { icon: '🔄', title: 'Campus Exchange', description: 'Swap the things you need with your campus community.', to: '/campus-exchange', theme: 'exchange' },
  { icon: '🔎', title: 'Lost & Found', description: 'Help belongings find their way back home.', to: '/lost-found', theme: 'lost' },
  { icon: '💬', title: 'Campus Voices', description: 'Share ideas and hear what students think.', to: '/campus-voices', theme: 'voices' },
  { icon: '📚', title: 'Resources', description: 'Find notes, papers and study material.', to: '/resources', theme: 'resources' },
  { icon: '🏆', title: 'Challenges', description: 'Take part in campus challenges and earn points.', to: '/challenges', theme: 'challenges' },
  { icon: '🔥', title: 'Deals', description: 'Explore active offers from student sellers.', to: '/deals', theme: 'deals' },
  { icon: '🤖', title: 'Campus AI', description: 'Search campus listings in your own words.', to: '/campus-ai', theme: 'ai' },
]

function CampusHome() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { user } = useAuth()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const submitSearch = (event) => {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace')
  }

  return <section className="campus-home">
    <div className="campus-hero">
      <div className="campus-hero-copy"><p className="eyebrow">Your campus, connected</p><p className="campus-greeting">{greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} <span aria-hidden="true">👋</span></p><h1>Your campus.<br />Your marketplace.<br /><span>Your community.</span></h1><p className="campus-hero-subtitle">Good finds, helpful people, and everything you need for campus life.</p>
        <form className="campus-hero-search" role="search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What are you looking for?" aria-label="Search marketplace"/><button type="submit">Search</button></form>
        <div className="campus-quick-actions" aria-label="Quick campus links"><Link to="/marketplace">🛍 Buy</Link><Link to="/campus-exchange">🔄 Exchange</Link><Link to="/lost-found">🔎 Lost item</Link><Link to="/resources">📚 Resources</Link><Link to="/campus-ai">✧ Ask Campus AI</Link></div>
      </div><div className="campus-hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><span className="hero-sticker sticker-book">📚</span><span className="hero-sticker sticker-headphones">🎧</span><span className="hero-sticker sticker-calculator">🧮</span><span className="hero-sticker sticker-bag">🎒</span><span className="hero-sparkle sparkle-one">✦</span><span className="hero-sparkle sparkle-two">✳</span></div>
    </div>
    <div className="campus-home-heading"><p className="eyebrow">Explore CampusMart</p><h2>Everything for campus life</h2><p>Pick a space and get right to it.</p></div>
    <div className="campus-hub-grid">{sections.map((section) => <Link className={`campus-hub-card campus-card-${section.theme}`} to={section.to} key={section.title}><span className="campus-hub-icon" aria-hidden="true">{section.icon}</span><span className="campus-hub-title">{section.title}</span><span className="campus-hub-description">{section.description}</span><span className="campus-hub-link">Explore <span aria-hidden="true">→</span></span></Link>)}</div>
  </section>
}

export default CampusHome
