import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Invoice from '../components/Invoice'

const STATUS_COLORS = {
    confirmed: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-amber-50 text-amber-700',
    completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-400',
    no_show: 'bg-gray-100 text-gray-400',
}

const emptyAppt = { customer_id: '', staff_id: '', service_id: '', scheduled_at: '', notes: '', status: 'confirmed', amount: '' }
const emptyCustomer = { name: '', phone: '', email: '' }

function getTodayLocal() {
    const t = new Date()
    return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

export default function Appointments() {
    const [appointments, setAppointments] = useState([])
    const [customers, setCustomers] = useState([])
    const [staff, setStaff] = useState([])
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [showCheckout, setShowCheckout] = useState(null)
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [form, setForm] = useState(emptyAppt)
    const [newCustomer, setNewCustomer] = useState(emptyCustomer)
    const [saving, setSaving] = useState(false)
    const [savingCust, setSavingCust] = useState(false)
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState(getTodayLocal())

    useEffect(() => { fetchAll() }, [dateFilter])

    async function fetchAll() {
        setLoading(true)
        const [appts, custs, stf, svcs] = await Promise.all([
            supabase.from('appointments').select(`
        *, customers(id,name,phone,loyalty_points,total_visits,total_spent),
        users(name), services(name,category,duration_mins)
      `).gte('scheduled_at', dateFilter + 'T00:00:00')
                .lte('scheduled_at', dateFilter + 'T23:59:59')
                .order('scheduled_at'),
            supabase.from('customers').select('id,name,phone').order('name'),
            supabase.from('users').select('id,name').eq('is_active', true),
            supabase.from('services').select('id,name,price,duration_mins,category')
                .eq('is_active', true).order('name'),
        ])
        setAppointments(appts.data || [])
        setCustomers(custs.data || [])
        setStaff(stf.data || [])
        setServices(svcs.data || [])
        setLoading(false)
    }

    function onServiceChange(id) {
        const svc = services.find(s => s.id === id)
        setForm(f => ({ ...f, service_id: id, amount: svc ? svc.price : '' }))
    }

    async function addCustomer() {
        if (!newCustomer.name.trim()) return alert('Enter customer name')
        if (!newCustomer.phone.trim()) return alert('Enter phone number')
        setSavingCust(true)
        const { data, error } = await supabase
            .from('customers').insert(newCustomer).select().single()
        if (error) {
            alert('Could not save: ' + error.message)
        } else {
            setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
            setForm(f => ({ ...f, customer_id: data.id }))
            setNewCustomer(emptyCustomer)
            setShowQuickAdd(false)
        }
        setSavingCust(false)
    }

    async function save() {
        if (!form.customer_id) return alert('Please select a customer')
        if (!form.service_id) return alert('Please select a service')
        if (!form.scheduled_at) return alert('Please pick date and time')
        setSaving(true)
        const { error } = await supabase.from('appointments').insert(form)
        if (error) alert('Booking failed: ' + error.message)
        else { setShowForm(false); setForm(emptyAppt); fetchAll() }
        setSaving(false)
    }

    async function updateStatus(id, status) {
        await supabase.from('appointments').update({ status }).eq('id', id)
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    )
    const selectedCustomer = customers.find(c => c.id === form.customer_id)
    const selectedService = services.find(s => s.id === form.service_id)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Appointments</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{appointments.length} appointments</p>
                </div>
                <div className="flex gap-3 items-center">
                    <input type="date" value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                    <button
                        onClick={() => { setForm(emptyAppt); setSearch(''); setShowQuickAdd(false); setShowForm(true) }}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                        + Book Appointment
                    </button>
                </div>
            </div>

            {/* Appointment list */}
            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-gray-400">No appointments for this day.</p>
                    <p className="text-gray-300 text-sm mt-1">Click + Book Appointment to add one.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {appointments.map(a => (
                        <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                            {/* Top row - time + status */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-gray-800">
                                        {new Date(a.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-xs text-gray-400">{a.services?.duration_mins} min</div>
                                </div>
                                <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                                    className={`text-xs px-2 py-1.5 rounded-full border-0 font-medium focus:outline-none cursor-pointer ${STATUS_COLORS[a.status]}`}>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="no_show">No Show</option>
                                </select>
                            </div>

                            {/* Middle row - customer + service */}
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <div className="font-medium text-gray-800">{a.customers?.name}</div>
                                    <div className="text-xs text-gray-400">{a.customers?.phone}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-700">{a.services?.name}</div>
                                    <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                                        {a.services?.category}
                                    </span>
                                </div>
                            </div>

                            {/* Bottom row - staff + amount + checkout */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <div className="text-xs text-gray-500">{a.users?.name || 'Unassigned'}</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold text-gray-800 text-sm">
                                        Rs.{Number(a.amount).toLocaleString('en-IN')}
                                    </div>
                                    {a.status === 'completed' && (
                                        <button onClick={() => setShowCheckout(a)}
                                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                                            Checkout
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Book Appointment Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-base font-semibold text-gray-800 mb-5">Book Appointment</h2>

                        {/* Customer */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-500">Customer</label>
                                <button onClick={() => setShowQuickAdd(v => !v)}
                                    className="text-xs font-medium text-pink-600 hover:text-pink-800">
                                    {showQuickAdd ? 'Search existing' : '+ New customer'}
                                </button>
                            </div>

                            {showQuickAdd ? (
                                <div className="border border-pink-200 rounded-xl p-4 bg-pink-50 space-y-2">
                                    <p className="text-xs font-semibold text-pink-700 mb-1">New customer details</p>
                                    <input value={newCustomer.name}
                                        onChange={e => setNewCustomer(c => ({ ...c, name: e.target.value }))}
                                        placeholder="Full name *"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400" />
                                    <input value={newCustomer.phone}
                                        onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))}
                                        placeholder="Phone number *"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400" />
                                    <input value={newCustomer.email}
                                        onChange={e => setNewCustomer(c => ({ ...c, email: e.target.value }))}
                                        placeholder="Email (optional)"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400" />
                                    <button onClick={addCustomer} disabled={savingCust}
                                        className="w-full bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40 mt-1">
                                        {savingCust ? 'Saving...' : 'Save & Select'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Search by name or phone..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                    <select value={form.customer_id}
                                        onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                                        size={Math.min(filteredCustomers.length + 1, 5)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-pink-300">
                                        <option value="">-- select customer --</option>
                                        {filteredCustomers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                                        ))}
                                    </select>
                                    {selectedCustomer && (
                                        <p className="text-xs text-green-600 font-medium pl-1">
                                            Selected: {selectedCustomer.name}
                                        </p>
                                    )}
                                    {filteredCustomers.length === 0 && search && (
                                        <p className="text-xs text-gray-400 pl-1">
                                            No match - click "+ New customer" to add them
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Service */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Service</label>
                            <select value={form.service_id} onChange={e => onServiceChange(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                <option value="">Select service...</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} - Rs.{Number(s.price).toLocaleString('en-IN')} ({s.duration_mins} min)
                                    </option>
                                ))}
                            </select>
                            {selectedService && (
                                <p className="text-xs text-gray-400 mt-1 pl-1">
                                    {selectedService.category} - {selectedService.duration_mins} min - Rs.{Number(selectedService.price).toLocaleString('en-IN')}
                                </p>
                            )}
                        </div>

                        {/* Staff */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Assign to staff</label>
                            <select value={form.staff_id}
                                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                <option value="">Select staff member...</option>
                                {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date & Time */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Date and Time</label>
                            <input type="datetime-local" value={form.scheduled_at}
                                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                        </div>

                        {/* Notes */}
                        <div className="mb-5">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Notes (optional)</label>
                            <textarea value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                                rows={2} placeholder="Special requests, allergies..." />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => { setShowForm(false); setSearch('') }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                                {saving ? 'Booking...' : 'Book Appointment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && (
                <CheckoutModal
                    appointment={showCheckout}
                    onClose={() => setShowCheckout(null)}
                    onDone={() => { setShowCheckout(null); fetchAll() }}
                />
            )}
        </div>
    )
}

function CheckoutModal({ appointment: a, onClose, onDone }) {
    const [paymentMode, setPaymentMode] = useState('cash')
    const [discount, setDiscount] = useState(0)
    const [promoCode, setPromoCode] = useState('')
    const [promoOffer, setPromoOffer] = useState(null)
    const [promoError, setPromoError] = useState('')
    const [promoLoading, setPromoLoading] = useState(false)
    const [redeemPts, setRedeemPts] = useState(0)
    const [saving, setSaving] = useState(false)
    const [showInvoice, setShowInvoice] = useState(false)
    const [savedTxn, setSavedTxn] = useState(null)

    const subtotal = Number(a.amount || 0)
    const manualDiscount = Math.min(Number(discount || 0), subtotal)

    let promoDiscount = 0
    if (promoOffer) {
        promoDiscount = promoOffer.discount_type === 'percentage'
            ? Math.round(subtotal * promoOffer.discount_value / 100)
            : Number(promoOffer.discount_value)
    }

    const pointsDiscount = Math.floor((Number(redeemPts) || 0) / 100) * 10
    const totalDiscount = manualDiscount + promoDiscount + pointsDiscount
    const total = Math.max(0, subtotal - totalDiscount)
    const pointsEarned = Math.floor(total / 10)

    const maxRedeemable = Math.min(
        a.customers?.loyalty_points || 0,
        Math.floor(subtotal * 0.2 / 10) * 100
    )

    async function applyPromo() {
        if (!promoCode.trim()) return
        setPromoLoading(true)
        setPromoError('')
        setPromoOffer(null)
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase
            .from('offers').select('*')
            .eq('promo_code', promoCode.trim().toUpperCase())
            .eq('is_active', true)
            .lte('start_date', today)
            .gte('end_date', today)
            .single()
        if (!data) {
            setPromoError('Invalid or expired promo code')
        } else if (data.min_bill && subtotal < data.min_bill) {
            setPromoError('Min bill Rs.' + Number(data.min_bill).toLocaleString('en-IN') + ' required')
        } else if (data.max_uses && data.usage_count >= data.max_uses) {
            setPromoError('This offer has reached its usage limit')
        } else {
            setPromoOffer(data)
        }
        setPromoLoading(false)
    }

    async function processCheckout() {
        setSaving(true)

        // 1. Create transaction
        const { data: txnData, error: txnError } = await supabase
            .from('transactions').insert({
                appointment_id: a.id,
                customer_id: a.customer_id,
                staff_id: a.staff_id,
                subtotal,
                discount_amount: totalDiscount,
                loyalty_redeemed: pointsDiscount,
                total,
                payment_mode: paymentMode,
                offer_id: promoOffer?.id || null,
            }).select('*, customers(name, phone, email)').single()

        if (txnError) {
            alert('Payment failed: ' + txnError.message)
            setSaving(false)
            return
        }

        // 2. Auto-deduct inventory
        const { data: svcProducts } = await supabase
            .from('service_products')
            .select('product_id, quantity, inventory(stock_qty)')
            .eq('service_id', a.service_id)

        if (svcProducts && svcProducts.length > 0) {
            for (const sp of svcProducts) {
                const currentStock = Number(sp.inventory?.stock_qty || 0)
                const newStock = Math.max(0, currentStock - Number(sp.quantity))
                await supabase.from('inventory')
                    .update({ stock_qty: newStock, last_updated: new Date().toISOString() })
                    .eq('id', sp.product_id)
            }
        }

        // 3. Log commission
        if (a.staff_id) {
            const { data: staffData, error: staffErr } = await supabase
                .from('users').select('commission_rate').eq('id', a.staff_id).single()
            if (staffErr) {
                console.error('Failed to fetch staff commission rate:', staffErr)
            }
            if (staffData) {
                const commissionEarned = Math.round(total * staffData.commission_rate / 100)
                const { error: commErr } = await supabase.from('commission_log').insert({
                    staff_id: a.staff_id,
                    transaction_id: null,
                    service_amount: total,
                    commission_rate: staffData.commission_rate,
                    commission_earned: commissionEarned,
                    month: new Date().toISOString().slice(0, 7),
                    is_paid: false,
                })
                if (commErr) console.error('Commission log error:', commErr)
            }
        }

        // 4. Update offer usage
        if (promoOffer) {
            await supabase.from('offers')
                .update({ usage_count: (promoOffer.usage_count || 0) + 1 })
                .eq('id', promoOffer.id)
        }

        // 5. Update customer loyalty + tier
        const currentPoints = a.customers?.loyalty_points || 0
        const pointsUsed = Number(redeemPts) || 0
        const newPoints = currentPoints - pointsUsed + pointsEarned
        const newVisits = (a.customers?.total_visits || 0) + 1
        const newSpent = (Number(a.customers?.total_spent) || 0) + total
        const tier =
            newVisits >= 25 && newSpent >= 60000 ? 'platinum' :
                newVisits >= 12 && newSpent >= 25000 ? 'gold' :
                    newVisits >= 5 && newSpent >= 10000 ? 'silver' : 'basic'

        await supabase.from('customers').update({
            total_visits: newVisits,
            total_spent: newSpent,
            loyalty_points: newPoints,
            loyalty_tier: tier,
        }).eq('id', a.customer_id)

        // 6. Log loyalty events
        if (pointsEarned > 0) {
            await supabase.from('loyalty_events').insert({
                customer_id: a.customer_id,
                event_type: 'earned',
                points: pointsEarned,
                balance_after: newPoints,
                description: 'Earned from ' + (a.services?.name || 'service'),
            })
        }
        if (pointsUsed > 0) {
            await supabase.from('loyalty_events').insert({
                customer_id: a.customer_id,
                event_type: 'redeemed',
                points: -pointsUsed,
                balance_after: newPoints,
                description: 'Redeemed ' + pointsUsed + ' pts for Rs.' + pointsDiscount + ' off',
            })
        }

        setSaving(false)
        setSavedTxn(txnData)
        setShowInvoice(true)
    }

    // Show invoice after checkout
    if (showInvoice && savedTxn) {
        return (
            <Invoice
                transaction={savedTxn}
                appointment={a}
                onClose={() => { setShowInvoice(false); onDone() }}
            />
        )
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-base font-semibold text-gray-800 mb-1">Checkout</h2>
                <p className="text-sm text-gray-400 mb-4">{a.customers?.name} - {a.services?.name}</p>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Service charge</span>
                        <span className="font-medium">Rs.{subtotal.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Manual discount */}
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Manual discount (Rs.)</span>
                        <input type="number" value={discount} min={0} max={subtotal}
                            onChange={e => setDiscount(e.target.value)}
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-pink-300" />
                    </div>

                    {/* Promo code */}
                    <div>
                        <div className="flex gap-1.5 mt-1">
                            <input value={promoCode}
                                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoOffer(null); setPromoError('') }}
                                placeholder="Promo code"
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:border-pink-300" />
                            <button onClick={applyPromo} disabled={promoLoading || !promoCode}
                                className="bg-pink-100 text-pink-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-pink-200 disabled:opacity-40">
                                {promoLoading ? '...' : 'Apply'}
                            </button>
                        </div>
                        {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
                        {promoOffer && (
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-green-600 font-medium">
                                    {promoOffer.title} - Rs.{promoDiscount.toLocaleString('en-IN')} off
                                </p>
                                <button onClick={() => { setPromoOffer(null); setPromoCode('') }}
                                    className="text-xs text-gray-400 hover:text-gray-600">remove</button>
                            </div>
                        )}
                    </div>

                    {/* Loyalty points */}
                    {(a.customers?.loyalty_points || 0) >= 100 && (
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">
                                Use points ({a.customers?.loyalty_points} available)
                            </span>
                            <select value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-pink-300">
                                <option value={0}>0 pts</option>
                                {[100, 200, 300, 400, 500].filter(p => p <= maxRedeemable).map(p => (
                                    <option key={p} value={p}>{p} pts = Rs.{Math.floor(p / 100) * 10} off</option>
                                ))}
                                {maxRedeemable > 500 && (
                                    <option value={maxRedeemable}>
                                        {maxRedeemable} pts = Rs.{Math.floor(maxRedeemable / 100) * 10} off
                                    </option>
                                )}
                            </select>
                        </div>
                    )}

                    {totalDiscount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Total discount</span>
                            <span className="font-medium">- Rs.{totalDiscount.toLocaleString('en-IN')}</span>
                        </div>
                    )}

                    <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-base">
                        <span>Total</span>
                        <span className="text-pink-700">Rs.{total.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-green-600 font-medium">
                        + {pointsEarned} loyalty points will be earned
                    </p>
                </div>

                {/* Payment method */}
                <div className="mb-5">
                    <label className="text-xs text-gray-500 mb-2 block">Payment method</label>
                    <div className="grid grid-cols-4 gap-2">
                        {['cash', 'upi', 'card', 'wallet'].map(m => (
                            <button key={m} onClick={() => setPaymentMode(m)}
                                className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors ${paymentMode === m ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={processCheckout} disabled={saving}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Processing...' : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </div>
    )
}