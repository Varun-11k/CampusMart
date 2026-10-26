import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const routeDescriptions = [
  [/^\/$/, 'CampusMart | Your campus, in one place', 'Find campus essentials, explore student listings, and connect with your college community.'],
  [/^\/marketplace\/?$/, 'Campus Marketplace | CampusMart', 'Browse available products and useful finds shared by students near your campus.'],
  [/^\/products\/[^/]+\/?$/, 'Campus Marketplace Listing | CampusMart', 'Explore student marketplace listings on CampusMart.'],
  [/^\/lost-found\/?$/, 'Campus Lost & Found | CampusMart', 'Browse public lost and found reports from your campus community.'],
  [/^\/campus-voices\/?$/, 'Campus Voices | CampusMart', 'Read and share anonymous, moderated posts from your campus community.'],
  [/^\/resources\/?$/, 'Study Resources | CampusMart', 'Discover study resources shared by students in your campus community.'],
  [/^\/resources\/[^/]+\/?$/, 'Student Study Resource | CampusMart', 'Explore study materials shared with your campus community.'],
  [/^\/campus-exchange\/?$/, 'Campus Exchange | CampusMart', 'Find campus item exchanges and requests shared by students.'],
  [/^\/deals\/?$/, 'Campus Deals | CampusMart', 'Browse current deals and offers shared with the campus community.'],
  [/^\/challenges\/?$/, 'Campus Challenges | CampusMart', 'Explore community challenges and activities on CampusMart.'],
  [/^\/campus-ai\/?$/, 'Campus AI Search | CampusMart', 'Search campus listings, lost items, and study resources with CampusMart AI.'],
  [/^\/privacy\/?$/, 'Privacy Policy | CampusMart', 'Read how CampusMart handles account and community information.'],
  [/^\/terms\/?$/, 'Terms of Use | CampusMart', 'Read the terms for using the CampusMart website and student community.'],
]

const privatePaths = [
  /^\/(?:home|profile|settings|wishlist|notifications|messages|admin|sell|login|register|forgot-password|reset-password|verify-email)(?:\/|$)/,
  /^\/campus-feed(?:\/|$)/,
  /^\/lost-found\/(?:my-reports|report)(?:\/|$)/,
  /^\/campus-voices\/(?:my-posts|create)(?:\/|$)/,
  /^\/resources\/(?:my-resources|share)(?:\/|$)/,
  /^\/campus-exchange\/(?:my-exchanges|create)(?:\/|$)/,
  /^\/campus-exchange\/[^/]+\/?$/,
  /^\/(?:lost-found|campus-voices)\/[^/]+\/?$/,
  /^\/messages\/[^/]+\/?$/,
]

function setMeta(attribute, key, value) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!value) {
    tag?.remove()
    return
  }
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.append(tag)
  }
  tag.setAttribute('content', value)
}

function PageMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = routeDescriptions.find(([pattern]) => pattern.test(pathname))
    const isPrivate = privatePaths.some((pattern) => pattern.test(pathname)) || !page
    const title = isPrivate ? 'Account | CampusMart' : page?.[1] || 'CampusMart | Your campus, in one place'
    const description = isPrivate
      ? 'Manage your CampusMart account and private activity.'
      : page?.[2] || 'A marketplace and community built for campus life.'
    const configuredSite = import.meta.env.VITE_SITE_URL?.trim()
    let siteOrigin = window.location.origin
    if (configuredSite) {
      try { siteOrigin = new URL(configuredSite).origin } catch { /* Keep the current deployment origin. */ }
    }

    document.title = title
    setMeta('name', 'description', description)
    setMeta('name', 'robots', isPrivate ? 'noindex, nofollow, noarchive' : 'index, follow')
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', new URL('/campusmart-512.png', siteOrigin).href)
    setMeta('property', 'og:url', new URL(pathname, siteOrigin).href)
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', new URL('/campusmart-512.png', siteOrigin).href)

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (isPrivate) {
      canonical?.remove()
    } else {
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.append(canonical)
      }
      canonical.href = new URL(pathname, siteOrigin).href
    }
  }, [pathname])

  return null
}

export default PageMetadata
