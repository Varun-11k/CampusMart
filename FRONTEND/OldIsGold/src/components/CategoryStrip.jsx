const categoryStyles = [
    { icon: '📚', color: 'mint' },
    { icon: '💻', color: 'blue' },
    { icon: '👕', color: 'peach' },
    { icon: '👟', color: 'yellow' },
    { icon: '🪑', color: 'lavender' },
    { icon: '🏠', color: 'rose' },
    { icon: '🏅', color: 'blue' },
    { icon: '🎨', color: 'mint' },
    { icon: '🎮', color: 'peach' },
    { icon: '🚲', color: 'yellow' },
    { icon: '🎸', color: 'lavender' },
    { icon: '✨', color: 'rose' },
]

function CategoryStrip({ activeCategory = '', onSelect, categories = [] }) {
    return (
        <div className="category-strip">
            <button
                className={`category-tile category-mint${!activeCategory ? ' is-active' : ''}`}
                type="button"
                onClick={() => onSelect?.('')}
            >
                <span className="category-icon" aria-hidden="true">✦</span>
                <span>All</span>
            </button>
            {categories.map((category, index) => {
                const name = typeof category === 'string' ? category : category.name
                const style = categoryStyles[index % categoryStyles.length]
                return (
                <button
                    className={`category-tile category-${style.color}${activeCategory === name ? ' is-active' : ''}`}
                    key={name}
                    type="button"
                    onClick={() => onSelect?.(activeCategory === name ? '' : name)}
                >
                    <span className="category-icon" aria-hidden="true">{style.icon}</span>
                    <span>{name}</span>
                    {typeof category === 'object' && Number.isFinite(category.listingCount) && <small>{category.listingCount} listings</small>}
                </button>
                )
            })}
        </div>
    )
}

export default CategoryStrip
