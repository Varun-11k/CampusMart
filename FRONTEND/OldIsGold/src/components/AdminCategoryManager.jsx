import { useEffect, useState } from 'react'
import { adminApi } from '../services/api'

function AdminCategoryManager({ token }) {
    const [categories, setCategories] = useState([])
    const [name, setName] = useState('')
    const [subcategories, setSubcategories] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        let active = true
        adminApi.categories(token).then((data) => {
            if (active) setCategories(data.categories || [])
        }).catch((requestError) => {
            if (active) setError(requestError.message)
        })
        return () => { active = false }
    }, [token])

    const createCategory = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const data = await adminApi.createCategory(token, {
                name: name.trim(),
                subcategories: subcategories.split(',').map((item) => item.trim()).filter(Boolean),
            })
            setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)))
            setName('')
            setSubcategories('')
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSaving(false)
        }
    }

    const updateCategory = async (category, updates) => {
        setSaving(true)
        setError('')
        try {
            const data = await adminApi.updateCategory(token, category._id, { name: category.name, ...updates })
            setCategories((current) => current.map((item) => item._id === category._id ? data.category : item))
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSaving(false)
        }
    }

    return <section className="admin-category-manager" aria-labelledby="category-manager-title">
        <div className="admin-section-heading"><div><p className="eyebrow">Marketplace setup</p><h2 id="category-manager-title">Categories</h2></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="admin-category-form" onSubmit={createCategory}>
            <label>New category<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label>
            <label>Subcategories <span>(comma separated, optional)</span><input value={subcategories} onChange={(event) => setSubcategories(event.target.value)} placeholder="e.g. Used, Refurbished" /></label>
            <button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Add category'}</button>
        </form>
        <div className="admin-category-list">
            {categories.map((category) => <article className="admin-category-row" key={category._id}>
                <div><strong>{category.name}</strong><span>{category.subcategories?.length ? category.subcategories.join(' · ') : 'No subcategories'}</span></div>
                <button className="admin-action" type="button" disabled={saving} onClick={() => {
                    const value = window.prompt('Update comma-separated subcategories', (category.subcategories || []).join(', '))
                    if (value !== null) updateCategory(category, { subcategories: value.split(',').map((item) => item.trim()).filter(Boolean) })
                }}>Edit subcategories</button>
                <button className="admin-action" type="button" disabled={saving} onClick={() => updateCategory(category, { active: !category.active })}>
                    {category.active ? 'Deactivate' : 'Activate'}
                </button>
                <span className={`admin-status status-${category.active ? 'active' : 'hidden'}`}>{category.active ? 'Active' : 'Inactive'}</span>
            </article>)}
            {categories.length === 0 && <p className="student-empty">No categories are available.</p>}
        </div>
    </section>
}

export default AdminCategoryManager
