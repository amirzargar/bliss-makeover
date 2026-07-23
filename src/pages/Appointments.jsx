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

const STATUS_CAL = {
    confirmed: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
    in_progress: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    completed: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
    cancelled: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    no_show: { bg: '#f3f4f6', border: '#9ca3af', text: '#4b5563' },
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am to 8pm

const emptyAppt = { customer_id: '', staff_id: '', service_id: '', scheduled_at: '', notes: '', status: 'confirmed', amount: '', booking_source: 'staff' }
const emptyCustomer = { name: '', phone: '', email: '' }

function getTodayLocal() {
    const t = new Date()
    return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

function getWeekDates(dateStr) {
    const date = new Date(dateStr)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d.toISOString().split('T')[0]
    })
}

function formatShortDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}

function isToday(dateStr) {
    return dateStr === getTodayLocal()
}

export default function Appointments() {
    const [appointments, setAppointments] = useState([])
    const [customers, setCustomers] = useState([])
    const [staff, setStaff] = useState([])
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [showCheckout, setShowCheckout] = useState(null)
    const [showWAPreview, setShowWAPreview] = useState(null)
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [form, setForm] = useState(emptyAppt)
    const [newCustomer, setNewCustomer] = useState(emptyCustomer)
    const [saving, setSaving] = useState(false)
    const [savingCust, setSavingCust] = useState(false)
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState(getTodayLocal())
    const [view, setView] = useState('list') // list | day | week
    const [selectedAppt, setSelectedAppt] = useState(null)

    useEffect(() => { fetchAll() }, [dateFilter])

    async function fetchAll() {
        setLoading(true)
        const weekDates = getWeekDates(dateFilter)
        const weekStart = weekDates[0]
        const weekEnd = weekDates[6]

        const [appts, custs, stf, svcs] = await Promise.all([
            supabase.from('appointments').select(`
        *, customers(id,name,phone,loyalty_points,total_visits,total_spent),
        users(name), services(name,category,duration_mins)
      `).gte('scheduled_at', weekStart + 'T00:00:00')
                .lte('scheduled_at', weekEnd + 'T23:59:59')
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
        if (error) { alert('Could not save: ' + error.message) }
        else {
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
        if (selectedAppt?.id === id) setSelectedAppt(prev => ({ ...prev, status }))
    }

    const todayAppts = appointments.filter(a =>
        a.scheduled_at.startsWith(dateFilter)
    )

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    )
    const selectedCustomer = customers.find(c => c.id === form.customer_id)
    const selectedService = services.find(s => s.id === form.service_id)
    const weekDates = getWeekDates(dateFilter)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Appointments</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {todayAppts.length} appointments on selected day
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap justify-end">
                    <input type="date" value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                    <button
                        onClick={() => { setForm(emptyAppt); setSearch(''); setShowQuickAdd(false); setShowForm(true) }}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                        + Book
                    </button>
                </div>
            </div>

            {/* View tabs */}
            <div className="flex gap-2 mb-4">
                {[
                    { key: 'list', label: 'List' },
                    { key: 'day', label: 'Day View' },
                    { key: 'week', label: 'Week View' },
                ].map(t => (
                    <button key={t.key} onClick={() => setView(t.key)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${view === t.key
                                ? 'bg-pink-600 text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}>
                        {t.label}
                    </button>
                ))}

                {/* Week navigation */}
                {view === 'week' && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => {
                                const d = new Date(dateFilter)
                                d.setDate(d.getDate() - 7)
                                setDateFilter(d.toISOString().split('T')[0])
                            }}
                            className="border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                            Prev week
                        </button>
                        <button
                            onClick={() => setDateFilter(getTodayLocal())}
                            className="border border-pink-200 text-pink-600 px-3 py-1.5 rounded-lg text-xs hover:bg-pink-50">
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(dateFilter)
                                d.setDate(d.getDate() + 7)
                                setDateFilter(d.toISOString().split('T')[0])
                            }}
                            className="border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                            Next week
                        </button>
                    </div>
                )}

                {/* Day navigation */}
                {view === 'day' && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => {
                                const d = new Date(dateFilter)
                                d.setDate(d.getDate() - 1)
                                setDateFilter(d.toISOString().split('T')[0])
                            }}
                            className="border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                            Prev
                        </button>
                        <button
                            onClick={() => setDateFilter(getTodayLocal())}
                            className="border border-pink-200 text-pink-600 px-3 py-1.5 rounded-lg text-xs hover:bg-pink-50">
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(dateFilter)
                                d.setDate(d.getDate() + 1)
                                setDateFilter(d.toISOString().split('T')[0])
                            }}
                            className="border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Status legend */}
            {(view === 'day' || view === 'week') && (
                <div className="flex gap-3 mb-4 flex-wrap">
                    {Object.entries(STATUS_CAL).map(([status, colors]) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: colors.bg, border: '1.5px solid ' + colors.border }} />
                            <span className="text-xs text-gray-500 capitalize">
                                {status.replace('_', ' ')}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : (
                <>
                    {/* ?? LIST VIEW ?? */}
                    {view === 'list' && (
                        <div>
                            {todayAppts.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-400">No appointments for this day.</p>
                                    <p className="text-gray-300 text-sm mt-1">
                                        Click + Book to add one.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {todayAppts.map(a => (
                                        <AppointmentCard
                                            key={a.id}
                                            a={a}
                                            onCheckout={() => setShowCheckout(a)}
                                            onWhatsApp={() => setShowWAPreview(a)}
                                            onStatusChange={updateStatus}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ?? DAY VIEW ?? */}
                    {view === 'day' && (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">
                                    {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', {
                                        weekday: 'long', day: 'numeric', month: 'long'
                                    })}
                                </span>
                                {isToday(dateFilter) && (
                                    <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">
                                        Today
                                    </span>
                                )}
                            </div>
                            <div className="overflow-y-auto max-h-[600px]">
                                {HOURS.map(hour => {
                                    const hourAppts = todayAppts.filter(a => {
                                        const h = new Date(a.scheduled_at).getHours()
                                        return h === hour
                                    })
                                    return (
                                        <div key={hour} className="flex border-b border-gray-50 min-h-[56px]">
                                            <div className="w-16 flex-shrink-0 px-3 py-2 text-xs text-gray-400 font-medium border-r border-gray-100">
                                                {hour > 12 ? (hour - 12) + ' PM' : hour === 12 ? '12 PM' : hour + ' AM'}
                                            </div>
                                            <div className="flex-1 p-1.5 flex flex-col gap-1">
                                                {hourAppts.map(a => {
                                                    const colors = STATUS_CAL[a.status] || STATUS_CAL.confirmed
                                                    return (
                                                        <button key={a.id}
                                                            onClick={() => setSelectedAppt(a)}
                                                            style={{
                                                                backgroundColor: colors.bg,
                                                                borderLeft: '3px solid ' + colors.border,
                                                                color: colors.text,
                                                            }}
                                                            className="text-left px-2 py-1.5 rounded-r-lg w-full hover:opacity-80 transition-opacity">
                                                            <div className="text-xs font-semibold truncate">
                                                                {new Date(a.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                {' '}{a.customers?.name}
                                                            </div>
                                                            <div className="text-xs opacity-80 truncate">
                                                                {a.services?.name}
                                                                {a.users?.name && ' - ' + a.users.name}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ?? WEEK VIEW ?? */}
                    {view === 'week' && (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            {/* Week header */}
                            <div className="grid border-b border-gray-100"
                                style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
                                <div className="bg-gray-50 border-r border-gray-100" />
                                {weekDates.map(d => (
                                    <div key={d}
                                        className={`bg-gray-50 px-1 py-2 text-center border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-pink-50 transition-colors ${isToday(d) ? 'bg-pink-50' : ''
                                            }`}
                                        onClick={() => { setDateFilter(d); setView('day') }}>
                                        <div className={`text-xs font-semibold ${isToday(d) ? 'text-pink-700' : 'text-gray-600'}`}>
                                            {formatShortDate(d)}
                                        </div>
                                        {isToday(d) && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mx-auto mt-0.5" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Week body */}
                            <div className="overflow-y-auto max-h-[560px]">
                                {HOURS.map(hour => (
                                    <div key={hour} className="flex border-b border-gray-50 min-h-[52px]">
                                        <div className="w-14 flex-shrink-0 px-2 py-1.5 text-xs text-gray-400 font-medium border-r border-gray-100 text-center">
                                            {hour > 12 ? (hour - 12) + 'p' : hour === 12 ? '12p' : hour + 'a'}
                                        </div>
                                        {weekDates.map(d => {
                                            const dayHourAppts = appointments.filter(a => {
                                                const apptDate = a.scheduled_at.split('T')[0]
                                                const apptHour = new Date(a.scheduled_at).getHours()
                                                return apptDate === d && apptHour === hour
                                            })
                                            return (
                                                <div key={d}
                                                    className={`flex-1 border-r border-gray-50 last:border-r-0 p-0.5 ${isToday(d) ? 'bg-pink-50/40' : ''
                                                        }`}>
                                                    {dayHourAppts.map(a => {
                                                        const colors = STATUS_CAL[a.status] || STATUS_CAL.confirmed
                                                        return (
                                                            <button key={a.id}
                                                                onClick={() => { setSelectedAppt(a); setDateFilter(d) }}
                                                                style={{
                                                                    backgroundColor: colors.bg,
                                                                    borderLeft: '2px solid ' + colors.border,
                                                                    color: colors.text,
                                                                }}
                                                                className="text-left w-full px-1 py-0.5 rounded-r text-xs mb-0.5 hover:opacity-80 transition-opacity block truncate">
                                                                {new Date(a.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                {' '}{a.customers?.name?.split(' ')[0]}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Appointment detail panel - shows when clicked in calendar */}
            {selectedAppt && (view === 'day' || view === 'week') && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="font-semibold text-gray-800">{selectedAppt.customers?.name}</div>
                                <div className="text-xs text-gray-400">{selectedAppt.customers?.phone}</div>
                            </div>
                            <button onClick={() => setSelectedAppt(null)}
                                className="text-gray-300 hover:text-gray-500 font-bold text-lg">x</button>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Service</span>
                                <span className="text-gray-800 font-medium">{selectedAppt.services?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Time</span>
                                <span className="text-gray-800">
                                    {new Date(selectedAppt.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Duration</span>
                                <span className="text-gray-800">{selectedAppt.services?.duration_mins} min</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Staff</span>
                                <span className="text-gray-800">{selectedAppt.users?.name || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-gray-800 font-semibold">
                                    Rs.{Number(selectedAppt.amount).toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>

                        {/* Status update */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-400 mb-1 block">Update status</label>
                            <select value={selectedAppt.status}
                                onChange={e => updateStatus(selectedAppt.id, e.target.value)}
                                className={`w-full text-xs px-3 py-2 rounded-lg border-0 font-medium focus:outline-none ${STATUS_COLORS[selectedAppt.status]}`}>
                                <option value="confirmed">Confirmed</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="no_show">No Show</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => { setShowWAPreview(selectedAppt); setSelectedAppt(null) }}
                                className="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-medium hover:bg-green-600">
                                WhatsApp
                            </button>
                            {selectedAppt.status === 'completed' && (
                                <button onClick={() => { setShowCheckout(selectedAppt); setSelectedAppt(null) }}
                                    className="flex-1 bg-green-700 text-white py-2 rounded-lg text-xs font-medium hover:bg-green-800">
                                    Checkout
                                </button>
                            )}
                            <button onClick={() => setSelectedAppt(null)}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-xs hover:bg-gray-50">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Book Appointment Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-base font-semibold text-gray-800 mb-5">Book Appointment</h2>

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

                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Date and Time</label>
                            <input type="datetime-local" value={form.scheduled_at}
                                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                        </div>

                        {/* Booking source */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Booking type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'staff', label: 'Pre-booked', desc: 'Called or messaged ahead' },
                                    { value: 'walk_in', label: 'Walk-in', desc: 'Came directly to salon' },
                                ].map(opt => (
                                    <button key={opt.value}
                                        onClick={() => setForm(f => ({ ...f, booking_source: opt.value }))}
                                        className={`p-3 rounded-xl border text-left transition-colors ${(form.booking_source || 'staff') === opt.value
                                                ? 'border-pink-300 bg-pink-50'
                                                : 'border-gray-200 bg-white hover:border-pink-200'
                                            }`}>
                                        <div className="text-xs font-semibold text-gray-800">{opt.label}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
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

            {/* WhatsApp Modal */}
            {showWAPreview && (
                <WhatsAppModal
                    appointment={showWAPreview}
                    onClose={() => setShowWAPreview(null)}
                />
            )}
        </div>
    )
}

function AppointmentCard({ a, onCheckout, onWhatsApp, onStatusChange }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-800">
                        {new Date(a.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-400">{a.services?.duration_mins} min</div>
                </div>
                <select value={a.status} onChange={e => onStatusChange(a.id, e.target.value)}
                    className={`text-xs px-2 py-1.5 rounded-full border-0 font-medium focus:outline-none cursor-pointer ${STATUS_COLORS[a.status]}`}>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                </select>
            </div>

            <div className="flex items-start justify-between mb-2">
                <div>
                    <div className="font-medium text-gray-800">{a.customers?.name}</div>
                    <div className="text-xs text-gray-400">{a.customers?.phone}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-700">{a.services?.name}</div>
                    <div className="flex gap-1 justify-end mt-0.5 flex-wrap">
                        <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                            {a.services?.category}
                        </span>
                        {a.booking_source === 'walk_in' && (
                            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                                Walk-in
                            </span>
                        )}
                        {a.booking_source === 'portal' && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                Portal
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div className="text-xs text-gray-500">{a.users?.name || 'Unassigned'}</div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="font-semibold text-gray-800 text-sm">
                        Rs.{Number(a.amount).toLocaleString('en-IN')}
                    </div>
                    <button onClick={onWhatsApp}
                        className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600">
                        WhatsApp
                    </button>
                    {a.status === 'completed' && (
                        <button onClick={onCheckout}
                            className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-800">
                            Checkout
                        </button>
                    )}
                </div>
            </div>
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

        if (a.staff_id) {
            const { data: staffData } = await supabase
                .from('users').select('commission_rate').eq('id', a.staff_id).single()
            if (staffData) {
                const commissionEarned = Math.round(total * staffData.commission_rate / 100)
                await supabase.from('commission_log').insert({
                    staff_id: a.staff_id,
                    transaction_id: null,
                    service_amount: total,
                    commission_rate: staffData.commission_rate,
                    commission_earned: commissionEarned,
                    month: new Date().toISOString().slice(0, 7),
                    is_paid: false,
                })
            }
        }

        if (promoOffer) {
            await supabase.from('offers')
                .update({ usage_count: (promoOffer.usage_count || 0) + 1 })
                .eq('id', promoOffer.id)
        }

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
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Manual discount (Rs.)</span>
                        <input type="number" value={discount} min={0} max={subtotal}
                            onChange={e => setDiscount(e.target.value)}
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-pink-300" />
                    </div>
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

function WhatsAppModal({ appointment: a, onClose }) {
    const customerName = a.customers?.name || 'there'
    const serviceName = a.services?.name || 'your appointment'
    const staffName = a.users?.name || 'our team'
    const customerPhone = a.customers?.phone || ''

    const apptDate = new Date(a.scheduled_at).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
    })
    const apptTime = new Date(a.scheduled_at).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    })

    const reminderMsg = [
        'Hi ' + customerName + '!',
        '',
        'This is a friendly reminder for your appointment at Bliss Makeover By BBI.',
        '',
        'Service: ' + serviceName,
        'Date: ' + apptDate,
        'Time: ' + apptTime,
        'Stylist: ' + staffName,
        '',
        'Please arrive 5 minutes early.',
        'See you soon!',
        '',
        '- Bliss Makeover By BBI',
        'Hair | Makeup | Skin',
    ].join('\n')

    const thankYouMsg = [
        'Hi ' + customerName + '!',
        '',
        'Thank you for visiting Bliss Makeover By BBI today.',
        'We hope you loved your ' + serviceName + '!',
        '',
        'Your loyalty points have been updated.',
        'We look forward to seeing you again soon!',
        '',
        '- Bliss Makeover By BBI',
        'Hair | Makeup | Skin',
    ].join('\n')

    const rescheduleMsg = [
        'Hi ' + customerName + '!',
        '',
        'We noticed your appointment on ' + apptDate + ' at ' + apptTime + ' was cancelled.',
        '',
        'We would love to reschedule for you at your convenience.',
        'Please call or message us to book a new slot.',
        '',
        '- Bliss Makeover By BBI',
        'Hair | Makeup | Skin',
    ].join('\n')

    const followUpMsg = [
        'Hi ' + customerName + '!',
        '',
        'It has been a while since your last visit at Bliss Makeover By BBI.',
        'We miss you!',
        '',
        'Book your next appointment and enjoy exclusive offers.',
        'Call or message us anytime.',
        '',
        '- Bliss Makeover By BBI',
        'Hair | Makeup | Skin',
    ].join('\n')

    const templates = [
        { label: 'Appointment Reminder', msg: reminderMsg },
        { label: 'Thank You Message', msg: thankYouMsg },
        { label: 'Reschedule Request', msg: rescheduleMsg },
        { label: 'Follow Up / We Miss You', msg: followUpMsg },
    ]

    const [selected, setSelected] = useState(0)
    const [message, setMessage] = useState(reminderMsg)

    function selectTemplate(index) {
        setSelected(index)
        setMessage(templates[index].msg)
    }

    function openWhatsApp() {
        const phone = customerPhone.replace(/\D/g, '')
        const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone
        const url = 'https://wa.me/' + phoneWithCode + '?text=' + encodeURIComponent(message)
        window.open(url, '_blank')
        onClose()
    }

    function copyMessage() {
        navigator.clipboard.writeText(message)
            .then(() => alert('Message copied to clipboard!'))
            .catch(() => alert('Could not copy - please select and copy manually'))
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-800">WhatsApp Message</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            To: {customerName} ({customerPhone || 'no phone on file'})
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-300 hover:text-gray-500 font-bold text-lg">x</button>
                </div>

                <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Choose template</p>
                    <div className="grid grid-cols-2 gap-2">
                        {templates.map((t, i) => (
                            <button key={i} onClick={() => selectTemplate(i)}
                                className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${selected === i
                                        ? 'bg-green-50 border-green-300 text-green-700'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                        Message preview (you can edit before sending)
                    </p>
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:border-green-300 leading-relaxed"
                        rows={10} />
                </div>

                {!customerPhone && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-xs text-amber-700 font-medium">
                            No phone number saved for this customer.
                            Add it in the Customers page first.
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={copyMessage}
                        className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Copy Message
                    </button>
                    <button onClick={openWhatsApp} disabled={!customerPhone}
                        className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-40">
                        Open WhatsApp
                    </button>
                </div>

                <p className="text-xs text-gray-400 text-center mt-3">
                    Opens WhatsApp with this message and number pre-filled
                </p>
            </div>
        </div>
    )
}