function LoadingSkeletons({ variant = 'product', count = 6, label = 'Loading content' }) {
  return <div className={`loading-grid loading-${variant}`} role="status" aria-label={label}>{Array.from({ length: count }, (_, index) => <div className="loading-card" aria-hidden="true" key={index}><span className="loading-media"/><span className="loading-line"/><span className="loading-line short"/><span className="loading-line tiny"/></div>)}</div>
}

export default LoadingSkeletons
