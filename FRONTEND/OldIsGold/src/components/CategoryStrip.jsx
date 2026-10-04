import { categories } from '../data/listings'

function CategoryStrip({ activeCategory = '', onSelect }) {
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
            {categories.map((category) => (
                <button
                    className={`category-tile category-${category.color}${activeCategory === category.name ? ' is-active' : ''}`}
                    key={category.name}
                    type="button"
                    onClick={() => onSelect?.(activeCategory === category.name ? '' : category.name)}
                >
                    <span className="category-icon" aria-hidden="true">{category.icon}</span>
                    <span>{category.name}</span>
                </button>
            ))}
        </div>
    )
}

export default CategoryStrip
