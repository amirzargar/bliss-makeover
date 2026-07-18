import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ProductSales() {
    const [products, setProducts] = useState([])
    const [customers, setCustomers] = useState([])
    const [staff, setStaff] = useState([])
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [custSearch, setCustSearch] = useState('')

    const [form, setForm] = useState({
        customer_id: '',
        staff_id: '',
        payment_mode: 'cash',
        discount: 0,
        notes: '',
    })

    const [cart, setCart] = useState([])

    useEffect(() => { fetchAll() }, [])

    async function fetchAll() {
        setLoading(true)
        const [prods, custs, stf, sl] = await Promise.all([
            supabase.from('inventory')
                .select('id, name, category, stock_qty, unit, unit_price')
                .gt('stock_qty', 0)
                .order('name'),
            supabase.from('customers').select('id, name, phone').order('name'),
            supabase.from('users').select('id, name').eq('is_active', true),
            supabase.from('product_sales')
                .select('*, customers(name, phone), users(name)')
                .order('created_at', { ascending: false })
                .limit(20),
        ])
        setProducts(prods.data || [])
        setCustomers(custs.data || [])
        setStaff(stf.data || [])
        setSales(sl.data || [])
        setLoading(false)
    }

    function addToCart(product) {
        const existing = cart.find(c => c.id === product.id)
        if (existing) {
            if (existing.qty >= Number(product.stock_qty)) {
                return alert('Not enough stock for ' + product.name)
            }
            setCart(prev => prev.map(c =>
                c.id === product.id ? { ...c, qty: c.qty + 1 } : c
            ))
        } else {
            setCart(prev => [...prev, {
                id: product.id,
                name: product.name,
                unit_price: Number(product.unit_price || 0),
                qty: 1,
                max_qty: Number(product.stock_qty),
                unit: product.unit,
            }])
        }
    }

    function updateQty(id, qty) {
        const num = Number(qty)
        if (num <= 0) {
            removeFromCart(id)
            return
        }
        setCart(prev => prev.map(c => c.id === id ? { ...c, qty: num } : c))
    }

    function removeFromCart(id) {
        setCart(prev => prev.filter(c => c.id !== id))
    }

    function updatePrice(id, price) {
        setCart(prev => prev.map(c =>
            c.id === id ? { ...c, unit_price: Number(price) } : c
        ))
    }

    const subtotal = cart.reduce((s, c) => s + c.unit_price * c.qty, 0)
    const discount = Number(form.discount || 0)
    const total = Math.max(0, subtotal - discount)

    async function completeSale() {
        if (cart.length === 0) return alert('Add at least one product to the cart')
        setSaving(true)

        const { data: sale, error: saleErr } = await supabase
            .from('product_sales').insert({
                customer_id: form.customer_id || null,
                staff_id: form.staff_id || null,
                notes: form.notes || null,
                payment_mode: form.payment_mode,
                subtotal,
                discount,
                total,
            }).select().single()

        if (saleErr) {
            alert('Sale failed: ' + saleErr.message)
            setSaving(false)
            return
        }

        // Insert sale items
        const items = cart.map(c => ({
            product_sale_id: sale.id,
            inventory_id: c.id,
            product_name: c.name,
            quantity: c.qty,
            unit_price: c.unit_price,
            total_price: c.unit_price * c.qty,
        }))
        await supabase.from('product_sale_items').insert(items)

        // Deduct stock for each product
        for (const c of cart) {
            const product = products.find(p => p.id === c.id)
            if (product) {
                const newStock = Math.max(0, Number(product.stock_qty) - c.qty)
                await supabase.from('inventory')
                    .update({ stock_qty: newStock, last_updated: new Date().toISOString() })
                    .eq('id', c.id)
            }
        }

        // Update customer spending if customer selected
        if (form.customer_id) {
            const { data: cust } = await supabase
                .from('customers')
                .select('total_spent, loyalty_points, total_visits')
                .eq('id', form.customer_id)
                .single()

            if (cust) {
                const pointsEarned = Math.floor(total / 20) // Rs.20 = 1 point for products
                const newPoints = (cust.loyalty_points || 0) + pointsEarned
                const newSpent = (Number(cust.total_spent) || 0) + total

                await supabase.from('customers').update({
                    total_spent: newSpent,
                    loyalty_points: newPoints,
                }).eq('id', form.customer_id)

                if (pointsEarned > 0) {
                    await supabase.from('loyalty_events').insert({
                        customer_id: form.customer_id,
                        event_type: 'earned',
                        points: pointsEarned,
                        balance_after: newPoints,
                        description: 'Earned from product purchase',
                    })
                }
            }
        }

        setSaving(false)
        setShowForm(false)
        setCart([])
        setForm({
            customer_id: '', staff_id: '', payment_mode: 'cash', discount: 0, notes: ''
        })
        fetchAll()
        alert('Sale completed! Total: Rs.' + total.toLocaleString('en-IN'))
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
    )

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
    )

    const selectedCustomer = customers.find(c => c.id === form.customer_id)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Product Sales</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Sell products directly without an appointment
                    </p>
                </div>
                <button
                    onClick={() => { setShowForm(true); setCart([]); }}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                    + New Sale
                </button>
            </div>

            {/* Recent sales */}
            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : sales.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-gray-400">No product sales yet.</p>
                    <p className="text-gray-300 text-sm mt-1">
                        Click + New Sale to sell a product directly.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-sm font-semibold text-gray-700">Recent Sales</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {sales.map(s => (
                            <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-800 text-sm">
                                        {s.customers?.name || 'Walk-in Customer'}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {new Date(s.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                        {' at '}
                                        {new Date(s.created_at).toLocaleTimeString('en-IN', {
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                        {s.users?.name && ' - ' + s.users.name}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="font-semibold text-gray-800 text-sm">
                                        Rs.{Number(s.total).toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-gray-400 capitalize">{s.payment_mode}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New Sale Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-2xl my-4">

                        {/* Modal header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-800">New Product Sale</h2>
                            <button
                                onClick={() => { setShowForm(false); setCart([]) }}
                                className="text-gray-300 hover:text-gray-500 font-bold text-lg">
                                x
                            </button>
                        </div>

                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

                            {/* Left - Product picker */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Select Products
                                </h3>

                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-pink-300" />

                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {filteredProducts.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-4">
                                            No products in stock match your search.
                                        </p>
                                    ) : filteredProducts.map(p => {
                                        const inCart = cart.find(c => c.id === p.id)
                                        return (
                                            <div key={p.id}
                                                className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 truncate">
                                                        {p.name}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        Rs.{Number(p.unit_price || 0).toLocaleString('en-IN')} -
                                                        {p.stock_qty} {p.unit} left
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addToCart(p)}
                                                    className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 ${inCart
                                                            ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                                            : 'bg-pink-600 text-white hover:bg-pink-700'
                                                        }`}>
                                                    {inCart ? 'Added (' + inCart.qty + ')' : '+ Add'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Right - Cart + details */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Cart
                                </h3>

                                {/* Cart items */}
                                {cart.length === 0 ? (
                                    <div className="bg-gray-50 rounded-xl p-6 text-center mb-4">
                                        <p className="text-sm text-gray-400">No products added yet</p>
                                        <p className="text-xs text-gray-300 mt-1">Click + Add on a product</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                                        {cart.map(c => (
                                            <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm font-medium text-gray-800 truncate flex-1">
                                                        {c.name}
                                                    </span>
                                                    <button
                                                        onClick={() => removeFromCart(c.id)}
                                                        className="text-red-400 hover:text-red-600 text-xs ml-2 flex-shrink-0">
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-gray-400">Qty:</span>
                                                        <input
                                                            type="number"
                                                            value={c.qty}
                                                            min={1}
                                                            max={c.max_qty}
                                                            onChange={e => updateQty(c.id, e.target.value)}
                                                            className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs text-center focus:outline-none" />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-gray-400">Price:</span>
                                                        <input
                                                            type="number"
                                                            value={c.unit_price}
                                                            min={0}
                                                            onChange={e => updatePrice(c.id, e.target.value)}
                                                            className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-center focus:outline-none" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-800 ml-auto">
                                                        Rs.{(c.unit_price * c.qty).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Bill summary */}
                                {cart.length > 0 && (
                                    <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Subtotal</span>
                                            <span>Rs.{subtotal.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Discount (Rs.)</span>
                                            <input
                                                type="number"
                                                value={form.discount}
                                                min={0}
                                                max={subtotal}
                                                onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                                                className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right focus:outline-none" />
                                        </div>
                                        <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-2">
                                            <span>Total</span>
                                            <span className="text-pink-700">Rs.{total.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Customer (optional) */}
                                <div className="mb-3">
                                    <label className="text-xs text-gray-500 mb-1 block">
                                        Customer (optional - for loyalty points)
                                    </label>
                                    <input
                                        value={custSearch}
                                        onChange={e => setCustSearch(e.target.value)}
                                        placeholder="Search customer..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-pink-300" />
                                    {custSearch && (
                                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                                            {filteredCustomers.slice(0, 5).map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        setForm(f => ({ ...f, customer_id: c.id }))
                                                        setCustSearch(c.name)
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 border-b border-gray-50">
                                                    {c.name} - {c.phone}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedCustomer && (
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs text-green-600 font-medium">
                                                Selected: {selectedCustomer.name}
                                            </p>
                                            <button
                                                onClick={() => { setForm(f => ({ ...f, customer_id: '' })); setCustSearch('') }}
                                                className="text-xs text-gray-400 hover:text-gray-600">
                                                clear
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Staff */}
                                <div className="mb-3">
                                    <label className="text-xs text-gray-500 mb-1 block">Staff member</label>
                                    <select value={form.staff_id}
                                        onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                        <option value="">Select staff...</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Payment method */}
                                <div className="mb-3">
                                    <label className="text-xs text-gray-500 mb-2 block">Payment method</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['cash', 'upi', 'card', 'wallet'].map(m => (
                                            <button key={m}
                                                onClick={() => setForm(f => ({ ...f, payment_mode: m }))}
                                                className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors ${form.payment_mode === m
                                                        ? 'bg-pink-600 text-white'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="mb-4">
                                    <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                                    <input
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Any notes about this sale..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-5 border-t border-gray-100">
                            <button
                                onClick={() => { setShowForm(false); setCart([]) }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={completeSale}
                                disabled={saving || cart.length === 0}
                                className="flex-1 bg-pink-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                                {saving
                                    ? 'Processing...'
                                    : 'Complete Sale - Rs.' + total.toLocaleString('en-IN')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}