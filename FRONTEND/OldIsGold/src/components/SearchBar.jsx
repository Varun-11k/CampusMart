function SearchBar({ value, onChange, compact = false, onKeyDown }) {
    return (
        <label className={`search-bar${compact ? ' search-bar-compact' : ''}`}>
            <span aria-hidden="true">⌕</span>
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search by title, category or college"
                aria-label="Search listings"
            />
        </label>
    )
}

export default SearchBar
