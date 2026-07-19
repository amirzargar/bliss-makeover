import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PortalBooking({ customer, onClose, onBooked }) {
    const [services, setServices] = useState([])
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [step, setStep] = useState(1) // 1=service, 2=datetime, 3=confirm
    const [selected, setSelected] = useState(null)
    const [staffId, setStaffId] = useState('')
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [notes, setNotes] = useState('')

    const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Bridal', 'Body', 'Makeup']
    const [catFilter, setCatFilter] = useState('All')

    const TIMES = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
        '18:00', '18:30', '19:00', '19:30',
    ]

    useEffect(() => {
        async function fetchData() {
            const [svcs, stf] = await Promise.all([
                supabase.from('services').select('*').eq('is_active', true).order('category'),
                supabase.from('users').select('id, name').eq('is_active', true),
            ])
            setServices(svcs.data || [])
            setStaff(stf.data || [])
            setLoading(false)
        }
        fetchData()

        // Default date to tomorrow
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setDate(tomorrow.toISOString().split('T')[0])
    }, [])

    async function confirmBooking() {
        if (!selected || !date || !time) return
        setSaving(true)

        const scheduledAt = date + 'T' + time + ':00'

        const { error } = await supabase.from('appointments').insert({
            customer_id: customer.id,
            service_id: selected.id,
            staff_id: staffId || null,
            scheduled_at: scheduledAt,
            amount: selected.price,
            status: 'confirmed',
            booking_source: 'portal',
            notes: notes || null,
        })

        if (error) {
            alert('Booking failed: ' + error.message)
            setSaving(false)
            return
        }

        setSaving(false)
        onBooked()
    }

    const filteredServices = catFilter === 'All'
        ? services
        : services.filter(s => s.category === catFilter)

    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 1)
    const minDateStr = minDate.toISOString().split('T')[0]

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)}
                                className="text-gray-400 hover:text-gray-600 text-sm">
                                Back
                            </button>
                        )}
                        <h2 className="text-base font-semibold text-gray-800">
                            {step === 1 && 'Choose Service'}
                            {step === 2 && 'Pick Date and Time'}
                            {step === 3 && 'Confirm Booking'}
                        </h2>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-300 hover:text-gray-500 font-bold text-xl">x</button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center px-5 py-3 gap-2 flex-shrink-0">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s <= step ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-400'
                                }`}>
                                {s}
                            </div>
                            {s < 3 && <div className={`h-0.5 w-8 ${s < step ? 'bg-pink-400' : 'bg-gray-100'}`} />}
                        </div>
                    ))}
                    <span className="text-xs text-gray-400 ml-2">
                        {step === 1 && 'Select service'}
                        {step === 2 && 'Choose time'}
                        {step === 3 && 'Review and confirm'}
                    </span>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                        Loading...
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-5 pb-5">

                        {/* STEP 1 - Select service */}
                        {step === 1 && (
                            <div>
                                {/* Category filter */}
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                                    {['All', ...CATEGORIES].map(c => (
                                        <button key={c} onClick={() => setCatFilter(c)}
                                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${catFilter === c
                                                    ? 'bg-pink-600 text-white'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}>
                                            {c}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    {filteredServices.map(s => (
                                        <button key={s.id}
                                            onClick={() => { setSelected(s); setStep(2) }}
                                            className={`w-full text-left p-4 rounded-2xl border transition-colors ${selected?.id === s.id
                                                    ? 'border-pink-300 bg-pink-50'
                                                    : 'border-gray-100 bg-white hover:border-pink-200'
                                                }`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        {s.duration_mins} min
                                                        {s.description && ' - ' + s.description}
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-3">
                                                    <div className="font-bold text-pink-700 text-sm">
                                                        Rs.{Number(s.price).toLocaleString('en-IN')}
                                                    </div>
                                                    <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                                                        {s.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 2 - Date and time */}
                        {step === 2 && (
                            <div className="space-y-4">
                                {selected && (
                                    <div className="bg-pink-50 rounded-2xl p-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-pink-700">{selected.name}</div>
                                            <div className="text-xs text-pink-500">{selected.duration_mins} min</div>
                                        </div>
                                        <div className="text-sm font-bold text-pink-700">
                                            Rs.{Number(selected.price).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-2 block">Select date</label>
                                    <input type="date" value={date} min={minDateStr}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-300" />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-2 block">Select time</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TIMES.map(t => (
                                            <button key={t} onClick={() => setTime(t)}
                                                className={`py-2 rounded-xl text-xs font-medium transition-colors ${time === t
                                                        ? 'bg-pink-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-600'
                                                    }`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                                        Preferred stylist (optional)
                                    </label>
                                    <select value={staffId} onChange={e => setStaffId(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-300">
                                        <option value="">No preference</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                                        Notes (optional)
                                    </label>
                                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                        placeholder="Any special requests or preferences..."
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-300"
                                        rows={2} />
                                </div>

                                <button
                                    onClick={() => { if (date && time) setStep(3) }}
                                    disabled={!date || !time}
                                    className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40">
                                    Continue to Confirm
                                </button>
                            </div>
                        )}

                        {/* STEP 3 - Confirm */}
                        {step === 3 && selected && (
                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-700">Booking Summary</h3>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Service</span>
                                        <span className="font-medium text-gray-800">{selected.name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Category</span>
                                        <span className="text-gray-800">{selected.category}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Duration</span>
                                        <span className="text-gray-800">{selected.duration_mins} min</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Date</span>
                                        <span className="font-medium text-gray-800">
                                            {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                                                weekday: 'long', day: 'numeric', month: 'long'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Time</span>
                                        <span className="font-medium text-gray-800">{time}</span>
                                    </div>
                                    {staffId && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Stylist</span>
                                            <span className="text-gray-800">
                                                {staff.find(s => s.id === staffId)?.name || 'Any available'}
                                            </span>
                                        </div>
                                    )}
                                    {notes && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Notes</span>
                                            <span className="text-gray-800 text-right max-w-[60%]">{notes}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold">
                                        <span className="text-gray-700">Total</span>
                                        <span className="text-pink-700 text-lg">
                                            Rs.{Number(selected.price).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                    <p className="text-xs text-blue-700">
                                        Your appointment will be confirmed instantly. You will receive a WhatsApp confirmation from Bliss Makeover shortly.
                                    </p>
                                </div>

                                <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
                                    <p className="text-xs text-pink-600">
                                        You have {customer.loyalty_points || 0} loyalty points worth Rs.{Math.floor((customer.loyalty_points || 0) / 100) * 10}. Show this at the salon to redeem during checkout.
                                    </p>
                                </div>

                                <button
                                    onClick={confirmBooking}
                                    disabled={saving}
                                    className="w-full bg-pink-600 text-white py-4 rounded-2xl text-sm font-bold hover:bg-pink-700 disabled:opacity-40">
                                    {saving ? 'Confirming...' : 'Confirm Appointment'}
                                </button>

                                <button onClick={() => setStep(2)}
                                    className="w-full border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm hover:bg-gray-50">
                                    Change Date or Time
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}