import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = {
    title: '', description: '', discount_type: 'percentage',
    discount_value: '', min_bill: 0, promo_code: '',
    applies_to: 'all', start_date: '', end_date: '',
    max_uses: '', is_active: true
}

const COLORS = [
    { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', val: 'text-pink-500' },
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', val: 'text-blue-500' },
    { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', val: 'text-green-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', val: 'text-amber-500' },
]

export default function Offers() {
    const [offers, setOffers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(empty)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('active')

    useEffect(() => { fetchOffers() }, [])

    async function fetchOffers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            alert('Failed to load offers. Please try again.')
        } else {
            setOffers(data || [])
        }
        setLoading(false)
    }

    async function save() {
        if (!form.title.trim()) return alert('Enter offer title')
        if (!form.discount_value) return alert('Enter discount value')
        if (!form.start_date) return alert('Enter start date')
        if (!form.end_date) return alert('Enter end date')
        if (form.end_date < form.start_date) return alert('End date must be after start date')

        setSaving(true)
        const payload = {
            ...form,
            discount_value: Number(form.discount_value),
            min_bill: Number(form.min_bill || 0),
            max_uses: form.max_uses ? Number(form.max_uses) : null,
            promo_code: form.promo_code?.trim().toUpperCase() || null,
        }

        const { error } = editing
            ? await supabase.from('offers').update(payload).eq('id', editing)
            : await supabase.from('offers').insert(payload)

        setSaving(false)
        if (error) {
            alert(`Error saving offer: ${error.message}`)
        } else {
            setShowForm(false)
            setForm(empty)
            setEditing(null)
            fetchOffers()
        }
    }

    async function toggleActive(id, current) {
        const { error } = await supabase.from('offers').update({ is_active: !current }).eq('id', id)
        if (error) {
            alert('Could not update status. Please try again.')
        } else {
            fetchOffers()
        }
    }

    async function deleteOffer(id) {
        if (!confirm('Delete this offer?')) return
        const { error } = await supabase.from('offers').delete().eq('id', id)
        if (error) {
            alert('Could not delete offer.')
        } else {
            fetchOffers()
        }
    }

    function startEdit(o) {
        setForm({
            title: o.title,
            description: o.description || '',
            discount_type: o.discount_type,
            discount_value: o.discount_value,
            min_bill: o.min_bill || 0,
            promo_code: o.promo_code || '',
            applies_to: o.applies_to || 'all',
            start_date: o.start_date,
            end_date: o.end_date,
            max_uses: o.max_uses || '',
            is_active: o.is_active,
        })
        setEditing(o.id)
        setShowForm(true)
    }

    function isExpired(o) { return new Date(o.end_date) < new Date() }
    function isUpcoming(o) { return new Date(o.start_date) > new Date() }

    function offerStatus(o) {
        if (!o.is_active) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-400' }
        if (isExpired(o)) return { label: 'Expired', cls: 'bg-red-50 text-red-400' }
        if (isUpcoming(o)) return { label: 'Upcoming', cls: 'bg-blue-50 text-blue-600' }
        return { label: 'Active', cls: 'bg-green-50 text-green-600' }
    }

    const filtered = offers.filter(o => {
        if (filter === 'active') return o.is_active && !isExpired(o) && !isUpcoming(o)
        if (filter === 'upcoming') return o.is_active && isUpcoming(o)
        if (filter === 'expired') return isExpired(o) || !o.is_active
        return true
    })

    const activeCount = offers.filter(o => o.is_active && !isExpired(o) && !isUpcoming(o)).length
    const upcomingCount = offers.filter(o => o.is_active && isUpcoming(o)).length
    const totalUsed = offers.reduce((s, o) => s + (o.usage_count || 0), 0)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Offers & Discounts</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {offers.length} total · {activeCount} active · used {totalUsed} times
                    </p>
                </div>
                <button
                    onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                    + Create Offer
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-semibold text-green-600">{activeCount}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Active offers</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-semibold text-blue-600">{upcomingCount}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Upcoming</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-semibold text-pink-600">{totalUsed}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Total redemptions</div>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
                {['all', 'active', 'upcoming', 'expired'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${filter === f
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}>
                        {f}
                    </button>
                ))}
            </div>

            {/* Offer cards */}
            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                    No offers here. Click "+ Create Offer" to add one.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((o, i) => {
                        const color = COLORS[i % COLORS.length]
                        const status = offerStatus(o)
                        const daysLeft = Math.ceil((new Date(o.end_date) - new Date()) / (1000 * 60 * 60 * 24))
                        return (
                            <div key={o.id} className={`${color.bg} border ${color.border} rounded-2xl p-5`}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-semibold text-sm ${color.text} truncate`}>{o.title}</div>
                                        {o.description && (
                                            <div className={`text-xs mt-0.5 ${color.val} opacity-80`}>{o.description}</div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                        <div className={`text-3xl font-bold ${color.text}`}>
                                            {o.discount_type === 'percentage'
                                                ? `${o.discount_value}%`
                                                : `Rs.${Number(o.discount_value).toLocaleString('en-IN')}`}
                                        </div>
                                        <div className={`text-xs ${color.val}`}>
                                            {o.discount_type === 'percentage' ? 'discount' : 'flat off'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
                                    {o.promo_code && (
                                        <span className={`font-mono font-semibold ${color.text} bg-white/60 px-2 py-0.5 rounded`}>
                                            {o.promo_code}
                                        </span>
                                    )}
                                    {Number(o.min_bill) > 0 && (
                                        <span className={color.val}>
                                            Min bill Rs.{Number(o.min_bill).toLocaleString('en-IN')}
                                        </span>
                                    )}
                                    {o.applies_to !== 'all' && (
                                        <span className={color.val}>For: {o.applies_to}</span>
                                    )}
                                    <span className={color.val}>
                                        {new Date(o.start_date).toLocaleDateString('en-IN')} — {new Date(o.end_date).toLocaleDateString('en-IN')}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                                            {status.label}
                                        </span>
                                        {!isExpired(o) && o.is_active && !isUpcoming(o) && daysLeft <= 7 && (
                                            <span className="text-xs text-amber-600 font-medium">{daysLeft}d left</span>
                                        )}
                                        <span className={`text-xs ${color.val}`}>
                                            Used {o.usage_count || 0}{o.max_uses ? `/${o.max_uses}` : ''} times
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => toggleActive(o.id, o.is_active)}
                                            className={`text-xs font-medium ${color.text} hover:opacity-70`}>
                                            {o.is_active ? 'Pause' : 'Activate'}
                                        </button>
                                        <button onClick={() => startEdit(o)}
                                            className="text-xs text-blue-500 hover:text-blue-700">
                                            Edit
                                        </button>
                                        <button onClick={() => deleteOffer(o.id)}
                                            className="text-xs text-red-400 hover:text-red-600">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">
                            {editing ? 'Edit Offer' : 'Create New Offer'}
                        </h2>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Offer title *</label>
                                <input value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Eid Special — 20% off Bridal Package"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                                <input value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Short note shown on the offer card"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Discount type *</label>
                                    <select value={form.discount_type}
                                        onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed amount (Rs.)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">
                                        {form.discount_type === 'percentage' ? 'Discount %' : 'Amount off (Rs.)'} *
                                    </label>
                                    <input type="number" value={form.discount_value}
                                        onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                                        placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 500'}
                                        max={form.discount_type === 'percentage' ? 100 : undefined}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Min bill amount (Rs.)</label>
                                    <input type="number" value={form.min_bill}
                                        onChange={e => setForm(f => ({ ...f, min_bill: e.target.value }))}
                                        placeholder="0 = no minimum"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Max uses (optional)</label>
                                    <input type="number" value={form.max_uses}
                                        onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                                        placeholder="blank = unlimited"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Promo code (optional)</label>
                                <input value={form.promo_code}
                                    onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. EID20 — staff enters this at checkout"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pink-300" />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Applies to</label>
                                <select value={form.applies_to}
                                    onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                    <option value="all">All services</option>
                                    <option value="Hair">Hair services only</option>
                                    <option value="Skin">Skin / Facial only</option>
                                    <option value="Bridal">Bridal only</option>
                                    <option value="Nails">Nails only</option>
                                    <option value="Body">Body only</option>
                                    <option value="Makeup">Makeup only</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Start date *</label>
                                    <input type="date" value={form.start_date}
                                        onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">End date *</label>
                                    <input type="date" value={form.end_date}
                                        onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="is_active" checked={form.is_active}
                                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                                <label htmlFor="is_active" className="text-sm text-gray-600">
                                    Active (visible and usable at checkout)
                                </label>
                            </div>
                        </div>

                        {/* Preview */}
                        {form.title && form.discount_value && (
                            <div className="mt-4 bg-pink-50 border border-pink-200 rounded-xl p-3">
                                <p className="text-xs text-pink-600 font-medium mb-1">Preview</p>
                                <p className="text-sm font-semibold text-pink-700">{form.title}</p>
                                <p className="text-xs text-pink-500 mt-0.5">
                                    {form.discount_type === 'percentage'
                                        ? `${form.discount_value}% off`
                                        : `Rs.${Number(form.discount_value).toLocaleString('en-IN')} off`}
                                    {Number(form.min_bill) > 0
                                        ? ` on bills above Rs.${Number(form.min_bill).toLocaleString('en-IN')}`
                                        : ''}
                                    {form.promo_code ? ` · Code: ${form.promo_code}` : ''}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 mt-5">
                            <button onClick={() => { setShowForm(false); setEditing(null) }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                                {saving ? 'Saving...' : editing ? 'Update Offer' : 'Create Offer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}