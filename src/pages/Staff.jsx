import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = { name: '', phone: '', role: 'staff', commission_rate: 10, is_active: true }

export default function Staff() {
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(empty)
    const [saving, setSaving] = useState(false)
    const [selected, setSelected] = useState(null)
    const [commission, setCommission] = useState([])
    const [allMonths, setAllMonths] = useState([])
    const [selMonth, setSelMonth] = useState(new Date().toISOString().slice(0, 7))
    const [marking, setMarking] = useState(false)

    useEffect(() => { fetchStaff() }, [])

    async function fetchStaff() {
        setLoading(true)
        const { data } = await supabase.from('users').select('*').order('name')
        setStaff(data || [])
        setLoading(false)
    }

    async function fetchCommission(staffId, month) {
        const { data } = await supabase
            .from('commission_log')
            .select('*')
            .eq('staff_id', staffId)
            .eq('month', month)
            .order('created_at', { ascending: false })
        setCommission(data || [])
    }

    async function fetchAllMonths(staffId) {
        const { data } = await supabase
            .from('commission_log')
            .select('month')
            .eq('staff_id', staffId)
            .order('month', { ascending: false })
        const unique = [...new Set((data || []).map(d => d.month))]
        setAllMonths(unique)
    }

    function openProfile(s) {
        setSelected(s)
        setSelMonth(new Date().toISOString().slice(0, 7))
        fetchCommission(s.id, new Date().toISOString().slice(0, 7))
        fetchAllMonths(s.id)
    }

    async function markPaid(staffId, month) {
        setMarking(true)
        await supabase.from('commission_log')
            .update({ is_paid: true, paid_at: new Date().toISOString() })
            .eq('staff_id', staffId)
            .eq('month', month)
            .eq('is_paid', false)
        fetchCommission(staffId, month)
        setMarking(false)
    }

    async function save() {
        if (!form.name.trim()) return alert('Enter staff name')
        if (!form.phone.trim()) return alert('Enter phone number')
        setSaving(true)
        if (editing) {
            await supabase.from('users').update({
                name: form.name, phone: form.phone, role: form.role,
                commission_rate: form.commission_rate, is_active: form.is_active,
            }).eq('id', editing)
        } else {
            await supabase.from('users').insert(form)
        }
        setSaving(false)
        setShowForm(false)
        setForm(empty)
        setEditing(null)
        fetchStaff()
    }

    function startEdit(s) {
        setForm({
            name: s.name, phone: s.phone || '', role: s.role,
            commission_rate: s.commission_rate, is_active: s.is_active
        })
        setEditing(s.id)
        setShowForm(true)
    }

    async function toggleActive(id, current) {
        await supabase.from('users').update({ is_active: !current }).eq('id', id)
        fetchStaff()
    }

    const totalEarned = commission.reduce((s, c) => s + Number(c.commission_earned), 0)
    const totalPaid = commission.filter(c => c.is_paid).reduce((s, c) => s + Number(c.commission_earned), 0)
    const totalDue = totalEarned - totalPaid
    const allPaid = commission.length > 0 && commission.every(c => c.is_paid)

    return (
        <div className="flex gap-4">

            {/* Staff list */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">Staff & Commission</h1>
                        <p className="text-sm text-gray-400 mt-0.5">{staff.length} team members</p>
                    </div>
                    <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                        + Add Staff
                    </button>
                </div>

                {loading ? (
                    <div className="text-center text-gray-400 py-12">Loading...</div>
                ) : (
                    <div className="space-y-3">
                        {staff.map(s => (
                            <div key={s.id} onClick={() => openProfile(s)}
                                className={`bg-white rounded-xl border p-4 flex items-center gap-4 cursor-pointer hover:border-pink-200 transition-colors ${selected?.id === s.id ? 'border-pink-300 bg-pink-50' : 'border-gray-100'
                                    }`}>
                                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold flex-shrink-0">
                                    {s.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-800">{s.name}</div>
                                    <div className="text-xs text-gray-400">{s.phone}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.role === 'admin' ? 'bg-pink-100 text-pink-700' : 'bg-blue-50 text-blue-600'
                                        }`}>{s.role}</span>
                                    <span className="text-xs text-gray-500">{s.commission_rate}% commission</span>
                                    <button onClick={e => { e.stopPropagation(); toggleActive(s.id, s.is_active) }}
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                        {s.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); startEdit(s) }}
                                        className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Commission panel */}
            {selected && (
                <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-5 self-start sticky top-0 max-h-screen overflow-y-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold">
                            {selected.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800 text-sm">{selected.name}</div>
                            <div className="text-xs text-gray-400">{selected.commission_rate}% rate</div>
                        </div>
                        <button onClick={() => setSelected(null)} className="ml-auto text-gray-300 hover:text-gray-500">x</button>
                    </div>

                    {/* Month selector */}
                    <div className="mb-4">
                        <label className="text-xs text-gray-500 mb-1 block">Select month</label>
                        <select value={selMonth}
                            onChange={e => { setSelMonth(e.target.value); fetchCommission(selected.id, e.target.value) }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                            {allMonths.length === 0
                                ? <option value={selMonth}>{selMonth}</option>
                                : allMonths.map(m => <option key={m} value={m}>{m}</option>)
                            }
                        </select>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                            <div className="text-base font-semibold text-gray-800">
                                Rs.{totalEarned.toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-400">Earned</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-2 text-center">
                            <div className="text-base font-semibold text-green-700">
                                Rs.{totalPaid.toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-400">Paid</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2 text-center">
                            <div className="text-base font-semibold text-amber-700">
                                Rs.{totalDue.toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-400">Due</div>
                        </div>
                    </div>

                    {/* Mark as paid button */}
                    {totalDue > 0 && (
                        <button onClick={() => markPaid(selected.id, selMonth)} disabled={marking}
                            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 mb-4">
                            {marking ? 'Marking...' : `Mark Rs.${totalDue.toLocaleString('en-IN')} as Paid`}
                        </button>
                    )}
                    {allPaid && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-center mb-4">
                            <p className="text-xs text-green-600 font-medium">All commission paid for {selMonth}</p>
                        </div>
                    )}

                    {/* Commission log */}
                    <div className="text-xs font-medium text-gray-500 mb-2">
                        Commission log ({commission.length} entries)
                    </div>
                    {commission.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-4">No entries for this month.</div>
                    ) : (
                        <div className="space-y-2">
                            {commission.map(c => (
                                <div key={c.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                                    <div>
                                        <div className="text-gray-600">{new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                                        <div className="text-gray-400">Service: Rs.{Number(c.service_amount).toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-gray-800">
                                            Rs.{Number(c.commission_earned).toLocaleString('en-IN')}
                                        </div>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.is_paid ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {c.is_paid ? 'Paid' : 'Due'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">
                            {editing ? 'Edit Staff Member' : 'Add Staff Member'}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Raheema"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Phone *</label>
                                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="e.g. 9419000010"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Role</label>
                                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                                        <option value="staff">Staff</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Commission %</label>
                                    <input type="number" min={0} max={100} value={form.commission_rate}
                                        onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                                </div>
                            </div>
                            {editing && (
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="is_active" checked={form.is_active}
                                        onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                                    <label htmlFor="is_active" className="text-sm text-gray-600">Active</label>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-3 bg-blue-50 rounded-lg p-2">
                            To give login access, invite them via Supabase Authentication with their email.
                        </p>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => { setShowForm(false); setEditing(null) }}
                                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                                {saving ? 'Saving...' : editing ? 'Update' : 'Add Staff'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}