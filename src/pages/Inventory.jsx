import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Body', 'Makeup', 'General']
const empty = { name: '', category: 'Hair', stock_qty: '', min_level: '', unit: 'units', unit_price: '', supplier: '' }

export default function Inventory() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(empty)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [adjustId, setAdjustId] = useState(null)
    const [adjustQty, setAdjustQty] = useState('')

    useEffect(() => { fetchItems() }, [])

    async function fetchItems() {
        setLoading(true)
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('name')

        if (error) console.error("Error fetching inventory:", error.message)
        setItems(data || [])
        setLoading(false)
    }

    async function save() {
        if (!form.name.trim()) return alert('Enter product name')
        if (form.stock_qty === '') return alert('Enter stock quantity')
        if (form.min_level === '') return alert('Enter minimum level')

        setSaving(true)

        const payload = {
            ...form,
            stock_qty: Number(form.stock_qty),
            min_level: Number(form.min_level),
            unit_price: form.unit_price !== '' ? Number(form.unit_price) : null,
            last_updated: new Date().toISOString()
        }

        if (editing) {
            await supabase.from('inventory').update(payload).eq('id', editing)
        } else {
            await supabase.from('inventory').insert(payload)
        }

        setSaving(false)
        setShowForm(false)
        setForm(empty)
        setEditing(null)
        fetchItems()
    }

    async function adjustStock(id, delta) {
        const item = items.find(i => i.id === id)
        if (!item) return
        const newQty = Math.max(0, Number(item.stock_qty) + delta)

        await supabase.from('inventory')
            .update({ stock_qty: newQty, last_updated: new Date().toISOString() })
            .eq('id', id)

        fetchItems()
        setAdjustId(null)
        setAdjustQty('')
    }

    async function deleteItem(id) {
        if (!confirm('Delete this product?')) return
        await supabase.from('inventory').delete().eq('id', id)
        fetchItems()
    }

    function startEdit(item) {
        setForm({
            name: item.name,
            category: item.category,
            stock_qty: item.stock_qty,
            min_level: item.min_level,
            unit: item.unit,
            unit_price: item.unit_price ?? '',
            supplier: item.supplier || ''
        })
        setEditing(item.id)
        setShowForm(true)
    }

    const lowStock = items.filter(i => Number(i.stock_qty) <= Number(i.min_level))
    const filtered = items.filter(i => {
        const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
        if (filter === 'low') return matchSearch && Number(i.stock_qty) <= Number(i.min_level)
        if (filter !== 'all') return matchSearch && i.category === filter
        return matchSearch
    })

    function statusPill(item) {
        const qty = Number(item.stock_qty)
        const min = Number(item.min_level)
        if (qty === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Out of stock</span>
        if (qty <= min) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Low stock</span>
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">OK</span>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Inventory</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{items.length} products · {lowStock.length} low stock</p>
                </div>
                <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 dynamic-shadow">
                    + Add Product
                </button>
            </div>

            {/* Low stock alert banner */}
            {lowStock.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                        <span className="font-medium">{lowStock.length} product{lowStock.length > 1 ? 's' : ''} low on stock:</span>
                        {' '}{lowStock.map(i => i.name).join(', ')}
                    </p>
                    <button onClick={() => setFilter('low')}
                        className="ml-auto text-xs text-amber-700 font-medium underline">
                        View all
                    </button>
                </div>
            )}

            {/* Search + filter panel */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-[160px] focus:outline-none focus:border-pink-300 transition-colors" />
                <button onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === 'all' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    All
                </button>
                <button onClick={() => setFilter('low')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === 'low' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    Low stock
                </button>
                {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setFilter(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === c ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {c}
                    </button>
                ))}
            </div>

            {/* Data Presentation Layer */}
            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading inventory records...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No products found matching the filter criteria.</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Stock</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Min Level</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Supplier</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{item.name}</div>
                                        {item.unit_price > 0 && (
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Rs.{Number(item.unit_price).toLocaleString('en-IN')} / {item.unit}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {adjustId === item.id ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => adjustStock(item.id, -Number(adjustQty || 1))}
                                                    className="w-6 h-6 rounded bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200 transition-colors">-</button>
                                                <input type="number" value={adjustQty}
                                                    onChange={e => setAdjustQty(e.target.value)}
                                                    className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:border-pink-300"
                                                    placeholder="1" />
                                                <button onClick={() => adjustStock(item.id, Number(adjustQty || 1))}
                                                    className="w-6 h-6 rounded bg-green-100 text-green-600 text-xs font-bold hover:bg-green-200 transition-colors">+</button>
                                                <button onClick={() => setAdjustId(null)}
                                                    className="text-xs text-gray-400 hover:text-gray-600 ml-1">×</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setAdjustId(item.id); setAdjustQty('') }}
                                                className="font-semibold text-gray-800 hover:text-pink-600 transition-colors border-b border-dotted border-gray-300 hover:border-pink-500">
                                                {item.stock_qty} {item.unit}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{item.min_level} {item.unit}</td>
                                    <td className="px-4 py-3">{statusPill(item)}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{item.supplier || '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(item)}
                                                className="text-xs text-blue-500 hover:text-blue-700 font-medium">Edit</button>
                                            <button onClick={() => deleteItem(item.id)}
                                                className="text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add / Edit Managed Overlay */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">
                            {editing ? 'Edit Product Parameters' : 'Register New Product'}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Product name *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. L'Oreal Hair Colour"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300 bg-white">
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Unit Type</label>
                                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300 bg-white">
                                        {['units', 'ml', 'grams', 'litres', 'packets', 'boxes'].map(u => <option key={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Current Stock Value *</label>
                                    <input type="number" value={form.stock_qty}
                                        onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))}
                                        placeholder="e.g. 10"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Minimum Alert Threshold *</label>
                                    <input type="number" value={form.min_level}
                                        onChange={e => setForm(f => ({ ...f, min_level: e.target.value }))}
                                        placeholder="e.g. 3"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Unit Price (Rs.)</label>
                                    <input type="number" value={form.unit_price}
                                        onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Supplier Entity</label>
                                    <input value={form.supplier}
                                        onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={() => { setShowForm(false); setEditing(null) }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40 transition-colors">
                                {saving ? 'Saving...' : editing ? 'Update Product' : 'Add Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}