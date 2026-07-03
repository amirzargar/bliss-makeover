import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Bridal', 'Body', 'Makeup']
const empty = { name: '', category: 'Hair', duration_mins: 60, price: '', description: '' }

export default function Services() {
    const [services, setServices] = useState([])
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(empty)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('All')
    const [showProducts, setShowProducts] = useState(null)
    const [svcProducts, setSvcProducts] = useState([])
    const [addProduct, setAddProduct] = useState({ product_id: '', quantity: 1 })

    useEffect(() => { fetchServices(); fetchInventory() }, [])

    async function fetchServices() {
        setLoading(true)
        const { data } = await supabase.from('services').select('*').order('category')
        setServices(data || [])
        setLoading(false)
    }

    async function fetchInventory() {
        const { data } = await supabase.from('inventory').select('id,name,unit').order('name')
        setInventory(data || [])
    }

    async function fetchServiceProducts(serviceId) {
        const { data } = await supabase
            .from('service_products')
            .select('id, quantity, inventory(id, name, unit)')
            .eq('service_id', serviceId)
        setSvcProducts(data || [])
    }

    async function save() {
        if (!form.name || !form.price) return alert('Enter name and price')
        setSaving(true)
        if (editing) {
            await supabase.from('services').update(form).eq('id', editing)
        } else {
            await supabase.from('services').insert(form)
        }
        setSaving(false)
        setShowForm(false)
        setForm(empty)
        setEditing(null)
        fetchServices()
    }

    async function toggleActive(id, current) {
        await supabase.from('services').update({ is_active: !current }).eq('id', id)
        fetchServices()
    }

    async function deleteService(id) {
        if (!confirm('Delete this service?')) return
        await supabase.from('services').delete().eq('id', id)
        fetchServices()
    }

    async function openProducts(s) {
        setShowProducts(s)
        fetchServiceProducts(s.id)
    }

    async function addSvcProduct() {
        if (!addProduct.product_id) return alert('Select a product')
        const { error } = await supabase.from('service_products').insert({
            service_id: showProducts.id,
            product_id: addProduct.product_id,
            quantity: Number(addProduct.quantity),
        })
        if (error) alert('Error: ' + error.message)
        else {
            setAddProduct({ product_id: '', quantity: 1 })
            fetchServiceProducts(showProducts.id)
        }
    }

    async function removeSvcProduct(id) {
        await supabase.from('service_products').delete().eq('id', id)
        fetchServiceProducts(showProducts.id)
    }

    function startEdit(s) {
        setForm({
            name: s.name, category: s.category, duration_mins: s.duration_mins,
            price: s.price, description: s.description || ''
        })
        setEditing(s.id)
        setShowForm(true)
    }

    const filtered = filter === 'All' ? services : services.filter(s => s.category === filter)
    const categories = ['All', ...CATEGORIES]

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Services</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{services.length} services</p>
                </div>
                <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                    + Add Service
                </button>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {categories.map(c => (
                    <button key={c} onClick={() => setFilter(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === c ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}>
                        {c}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No services yet.</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Service</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Duration</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Price</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Products used</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s, i) => (
                                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{s.name}</div>
                                        {s.description && <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                            {s.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{s.duration_mins} min</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        Rs.{Number(s.price).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => openProducts(s)}
                                            className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                                            Manage products
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => toggleActive(s.id, s.is_active)}
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                            {s.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(s)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                                            <button onClick={() => deleteService(s.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">
                            {editing ? 'Edit Service' : 'Add New Service'}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Service name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                                    placeholder="e.g. Hair Colouring (Global)" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Category</label>
                                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Duration (mins)</label>
                                    <input type="number" value={form.duration_mins}
                                        onChange={e => setForm({ ...form, duration_mins: parseInt(e.target.value) })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Price (Rs.)</label>
                                <input type="number" value={form.price}
                                    onChange={e => setForm({ ...form, price: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                                    placeholder="e.g. 2500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                                    rows={2} />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={() => { setShowForm(false); setEditing(null) }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
                                {saving ? 'Saving...' : editing ? 'Update' : 'Add Service'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product linking modal */}
            {showProducts && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-800">Products used</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{showProducts.name}</p>
                            </div>
                            <button onClick={() => setShowProducts(null)} className="text-gray-300 hover:text-gray-500">x</button>
                        </div>

                        <p className="text-xs text-gray-400 bg-blue-50 rounded-lg p-2 mb-4">
                            These products will be automatically deducted from inventory when this service is checked out.
                        </p>

                        {/* Current products */}
                        {svcProducts.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">No products linked yet.</p>
                        ) : (
                            <div className="space-y-2 mb-4">
                                {svcProducts.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                        <span className="text-sm text-gray-700">{p.inventory?.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">{p.quantity} {p.inventory?.unit}</span>
                                            <button onClick={() => removeSvcProduct(p.id)}
                                                className="text-xs text-red-400 hover:text-red-600">Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add product */}
                        <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">Link a product</p>
                            <div className="flex gap-2">
                                <select value={addProduct.product_id}
                                    onChange={e => setAddProduct(p => ({ ...p, product_id: e.target.value }))}
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                    <option value="">Select product...</option>
                                    {inventory.map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                    ))}
                                </select>
                                <input type="number" value={addProduct.quantity} min={0.1} step={0.1}
                                    onChange={e => setAddProduct(p => ({ ...p, quantity: e.target.value }))}
                                    className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-pink-300" />
                                <button onClick={addSvcProduct}
                                    className="bg-pink-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}