import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PortalBooking from './PortalBooking'

const TIERS = {
    basic: { label: 'Basic', bg: 'bg-gray-100', text: 'text-gray-600', next: 'Silver', needVisits: 5, needSpend: 10000 },
    silver: { label: 'Silver', bg: 'bg-gray-200', text: 'text-gray-700', next: 'Gold', needVisits: 12, needSpend: 25000 },
    gold: { label: 'Gold', bg: 'bg-amber-100', text: 'text-amber-700', next: 'Platinum', needVisits: 25, needSpend: 60000 },
    platinum: { label: 'Platinum', bg: 'bg-pink-100', text: 'text-pink-700', next: null, needVisits: 0, needSpend: 0 },
}

export default function PortalDashboard({ customer, onLogout, onCustomerUpdate }) {
    const [tab, setTab] = useState('home')
    const [appointments, setAppointments] = useState([])
    const [offers, setOffers] = useState([])
    const [loyaltyEvents, setLoyaltyEvents] = useState([])
    const [suggestions, setSuggestions] = useState([])
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(false)
    const [showBooking, setShowBooking] = useState(false)

    useEffect(() => {
        fetchData()
    }, [customer.id])

    async function fetchData() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        const [appts, offersData, loyalty, svcs] = await Promise.all([
            supabase.from('appointments')
                .select('*, services(name, category, duration_mins, price), users(name)')
                .eq('customer_id', customer.id)
                .order('scheduled_at', { ascending: false })
                .limit(20),

            supabase.from('offers')
                .select('*')
                .eq('is_active', true)
                .lte('start_date', today)
                .gte('end_date', today)
                .order('created_at', { ascending: false }),

            supabase.from('loyalty_events')
                .select('*')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false })
                .limit(15),

            supabase.from('services')
                .select('*')
                .eq('is_active', true)
                .order('name'),
        ])

        setAppointments(appts.data || [])
        setOffers(offersData.data || [])
        setLoyaltyEvents(loyalty.data || [])
        setServices(svcs.data || [])

        // Generate personalized suggestions
        generateSuggestions(appts.data || [], svcs.data || [])
        setLoading(false)
    }

    function generateSuggestions(appts, svcs) {
        if (appts.length === 0) {
            setSuggestions(svcs.slice(0, 3))
            return
        }

        // Count which categories customer books most
        const catCount = {}
        appts.forEach(a => {
            const cat = a.services?.category
            if (cat) catCount[cat] = (catCount[cat] || 0) + 1
        })

        // Sort categories by frequency
        const topCats = Object.entries(catCount)
            .sort((a, b) => b[1] - a[1])
            .map(([cat]) => cat)

        // Find services in top categories not recently booked
        const recentServiceIds = appts.slice(0, 3).map(a => a.service_id)
        let suggested = svcs.filter(s =>
            topCats.includes(s.category) && !recentServiceIds.includes(s.id)
        )

        // Check if it's time to rebook (last same-category booking > 4 weeks ago)
        const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
        const lastBookingByCategory = {}
        appts.forEach(a => {
            const cat = a.services?.category
            const date = new Date(a.scheduled_at)
            if (!lastBookingByCategory[cat] || date > lastBookingByCategory[cat]) {
                lastBookingByCategory[cat] = date
            }
        })

        // Add rebooking suggestions for overdue categories
        const overdueServices = svcs.filter(s => {
            const lastBooked = lastBookingByCategory[s.category]
            return lastBooked && lastBooked < fourWeeksAgo
        })

        const combined = [...new Map(
            [...overdueServices, ...suggested].map(s => [s.id, s])
        ).values()].slice(0, 4)

        setSuggestions(combined.length > 0 ? combined : svcs.slice(0, 3))
    }

    async function refreshCustomer() {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customer.id)
            .single()
        if (data) onCustomerUpdate(data)
    }

    const tier = TIERS[customer.loyalty_tier] || TIERS.basic
    const upcoming = appointments.filter(a =>
        new Date(a.scheduled_at) >= new Date() && a.status !== 'cancelled'
    )
    const past = appointments.filter(a =>
        new Date(a.scheduled_at) < new Date() || a.status === 'completed'
    )
    const pointsValue = Math.floor((customer.loyalty_points || 0) / 100) * 10

    return (
        <div className="min-h-screen bg-gray-50">

            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-pink-700">Bliss Makeover</div>
                        <div className="text-xs text-gray-400">Customer Portal</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{customer.name.split(' ')[0]}</span>
                        <button onClick={onLogout}
                            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg">
                            Sign out
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-4 pb-24">

                {/* ?? HOME TAB ?? */}
                {tab === 'home' && (
                    <div className="space-y-4">

                        {/* Welcome + tier card */}
                        <div className="bg-gradient-to-r from-pink-600 to-pink-500 rounded-2xl p-5 text-white">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="text-lg font-bold">Hi, {customer.name.split(' ')[0]}!</div>
                                    <div className="text-pink-200 text-xs mt-0.5">Welcome to your beauty space</div>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${tier.bg} ${tier.text}`}>
                                    {tier.label}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <div className="text-xl font-bold">{customer.loyalty_points || 0}</div>
                                    <div className="text-xs text-pink-100">Points</div>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <div className="text-xl font-bold">{customer.total_visits || 0}</div>
                                    <div className="text-xs text-pink-100">Visits</div>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <div className="text-xl font-bold">Rs.{pointsValue}</div>
                                    <div className="text-xs text-pink-100">Points value</div>
                                </div>
                            </div>
                        </div>

                        {/* Book appointment CTA */}
                        <button
                            onClick={() => setShowBooking(true)}
                            className="w-full bg-pink-600 text-white py-4 rounded-2xl text-sm font-bold hover:bg-pink-700 transition-colors">
                            + Book New Appointment
                        </button>

                        {/* Upcoming appointments */}
                        {upcoming.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Appointments</h2>
                                <div className="space-y-3">
                                    {upcoming.slice(0, 3).map(a => (
                                        <div key={a.id} className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <div className="text-xs font-bold text-blue-700">
                                                    {new Date(a.scheduled_at).getDate()}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate">
                                                    {a.services?.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(a.scheduled_at).toLocaleDateString('en-IN', {
                                                        weekday: 'short', day: 'numeric', month: 'short'
                                                    })}
                                                    {' at '}
                                                    {new Date(a.scheduled_at).toLocaleTimeString('en-IN', {
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                    {a.users?.name && ' with ' + a.users.name}
                                                </div>
                                            </div>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                                {a.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Personalized suggestions */}
                        {suggestions.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <h2 className="text-sm font-semibold text-gray-700 mb-1">Recommended for You</h2>
                                <p className="text-xs text-gray-400 mb-3">Based on your visit history</p>
                                <div className="space-y-2">
                                    {suggestions.map(s => (
                                        <div key={s.id}
                                            className="flex items-center justify-between bg-pink-50 rounded-xl px-3 py-2.5">
                                            <div>
                                                <div className="text-sm font-medium text-gray-800">{s.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {s.duration_mins} min - Rs.{Number(s.price).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowBooking(true)}
                                                className="text-xs bg-pink-600 text-white px-3 py-1.5 rounded-lg hover:bg-pink-700 flex-shrink-0 ml-2">
                                                Book
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active offers */}
                        {offers.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                                    Active Offers ({offers.length})
                                </h2>
                                <div className="space-y-2">
                                    {offers.slice(0, 3).map((o, i) => {
                                        const colors = [
                                            'bg-pink-50 border-pink-200 text-pink-700',
                                            'bg-blue-50 border-blue-200 text-blue-700',
                                            'bg-green-50 border-green-200 text-green-700',
                                        ]
                                        return (
                                            <div key={o.id}
                                                className={`border rounded-xl p-3 flex items-center justify-between ${colors[i % colors.length]}`}>
                                                <div>
                                                    <div className="text-sm font-semibold">{o.title}</div>
                                                    {o.description && (
                                                        <div className="text-xs opacity-70 mt-0.5">{o.description}</div>
                                                    )}
                                                    {o.promo_code && (
                                                        <div className="text-xs font-mono font-bold mt-1 opacity-80">
                                                            Code: {o.promo_code}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-2xl font-bold flex-shrink-0 ml-3">
                                                    {o.discount_type === 'percentage'
                                                        ? o.discount_value + '%'
                                                        : 'Rs.' + Number(o.discount_value).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ?? APPOINTMENTS TAB ?? */}
                {tab === 'appointments' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800">My Appointments</h2>
                            <button
                                onClick={() => setShowBooking(true)}
                                className="bg-pink-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-pink-700">
                                + Book New
                            </button>
                        </div>

                        {appointments.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 text-sm">No appointments yet.</p>
                                <button
                                    onClick={() => setShowBooking(true)}
                                    className="mt-3 bg-pink-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-pink-700">
                                    Book your first appointment
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {appointments.map(a => {
                                    const isPast = new Date(a.scheduled_at) < new Date()
                                    const statusColors = {
                                        confirmed: 'bg-blue-100 text-blue-700',
                                        in_progress: 'bg-amber-100 text-amber-700',
                                        completed: 'bg-green-100 text-green-700',
                                        cancelled: 'bg-red-100 text-red-500',
                                        no_show: 'bg-gray-100 text-gray-500',
                                    }
                                    return (
                                        <div key={a.id}
                                            className={`bg-white rounded-2xl border p-4 ${isPast ? 'border-gray-100 opacity-80' : 'border-pink-100'
                                                }`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="font-semibold text-gray-800 text-sm">
                                                        {a.services?.name}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        {a.services?.category} - {a.services?.duration_mins} min
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status]}`}>
                                                    {a.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                                <span>
                                                    {new Date(a.scheduled_at).toLocaleDateString('en-IN', {
                                                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                                                    })}
                                                    {' at '}
                                                    {new Date(a.scheduled_at).toLocaleTimeString('en-IN', {
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                                {a.users?.name && (
                                                    <span className="text-pink-500">with {a.users.name}</span>
                                                )}
                                            </div>
                                            {a.amount && (
                                                <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between text-xs">
                                                    <span className="text-gray-400">Amount</span>
                                                    <span className="font-semibold text-gray-800">
                                                        Rs.{Number(a.amount).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ?? LOYALTY TAB ?? */}
                {tab === 'loyalty' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">Loyalty Points</h2>

                        {/* Points card */}
                        <div className="bg-gradient-to-r from-pink-600 to-pink-500 rounded-2xl p-5 text-white text-center">
                            <div className="text-4xl font-bold mb-1">{customer.loyalty_points || 0}</div>
                            <div className="text-pink-200 text-sm">Total Points</div>
                            <div className="text-white font-semibold mt-2">
                                Worth Rs.{pointsValue} in discounts
                            </div>
                            <div className="text-xs text-pink-200 mt-1">100 points = Rs.10 off</div>
                        </div>

                        {/* Tier progress */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-700">Your Tier</h3>
                                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${tier.bg} ${tier.text}`}>
                                    {tier.label}
                                </span>
                            </div>
                            {tier.next ? (
                                <>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Progress to {tier.next}
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <span>Visits</span>
                                                <span>{customer.total_visits} / {tier.needVisits}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-pink-400 rounded-full transition-all"
                                                    style={{ width: Math.min(100, Math.round((customer.total_visits / tier.needVisits) * 100)) + '%' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <span>Total spending</span>
                                                <span>Rs.{Number(customer.total_spent || 0).toLocaleString('en-IN')} / Rs.{tier.needSpend.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-pink-400 rounded-full transition-all"
                                                    style={{ width: Math.min(100, Math.round((Number(customer.total_spent || 0) / tier.needSpend) * 100)) + '%' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3 text-center">
                                        {Math.max(0, tier.needVisits - customer.total_visits)} more visits and
                                        Rs.{Math.max(0, tier.needSpend - Number(customer.total_spent || 0)).toLocaleString('en-IN')} more spending to reach {tier.next}
                                    </p>
                                </>
                            ) : (
                                <div className="text-center py-3">
                                    <div className="text-2xl mb-2">*</div>
                                    <p className="text-sm font-semibold text-pink-700">Platinum Member!</p>
                                    <p className="text-xs text-gray-400 mt-1">You have reached our highest tier. Enjoy 15% discount on all services!</p>
                                </div>
                            )}
                        </div>

                        {/* Tier benefits */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tier Benefits</h3>
                            <div className="space-y-2 text-xs">
                                {[
                                    { tier: 'Basic', visits: '1+', discount: '0%', points: '1x' },
                                    { tier: 'Silver', visits: '5+', discount: '5%', points: '1.5x' },
                                    { tier: 'Gold', visits: '12+', discount: '10%', points: '2x' },
                                    { tier: 'Platinum', visits: '25+', discount: '15%', points: '3x' },
                                ].map(t => (
                                    <div key={t.tier}
                                        className={`flex items-center justify-between p-2 rounded-lg ${tier.label === t.tier ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50'
                                            }`}>
                                        <span className={`font-medium ${tier.label === t.tier ? 'text-pink-700' : 'text-gray-600'}`}>
                                            {t.tier} {tier.label === t.tier ? '(You)' : ''}
                                        </span>
                                        <span className="text-gray-500">{t.visits} visits</span>
                                        <span className="text-gray-500">{t.discount} off</span>
                                        <span className="text-gray-500">{t.points} pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Points history */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Points History</h3>
                            {loyaltyEvents.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-3">No points activity yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {loyaltyEvents.map(e => (
                                        <div key={e.id} className="flex items-center justify-between text-xs">
                                            <div>
                                                <div className="text-gray-700">{e.description || e.event_type}</div>
                                                <div className="text-gray-400">
                                                    {new Date(e.created_at).toLocaleDateString('en-IN')}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-semibold ${e.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {e.points > 0 ? '+' : ''}{e.points} pts
                                                </div>
                                                <div className="text-gray-400">bal: {e.balance_after}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ?? OFFERS TAB ?? */}
                {tab === 'offers' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">Offers for You</h2>

                        {offers.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 text-sm">No active offers right now.</p>
                                <p className="text-gray-300 text-xs mt-1">Check back soon!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {offers.map((o, i) => {
                                    const palettes = [
                                        { bg: 'bg-pink-50', border: 'border-pink-200', title: 'text-pink-800', val: 'text-pink-600' },
                                        { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', val: 'text-blue-600' },
                                        { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-800', val: 'text-green-600' },
                                        { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-800', val: 'text-amber-600' },
                                    ]
                                    const p = palettes[i % palettes.length]
                                    return (
                                        <div key={o.id} className={`${p.bg} border ${p.border} rounded-2xl p-4`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className={`font-bold text-sm ${p.title}`}>{o.title}</div>
                                                    {o.description && (
                                                        <div className={`text-xs mt-0.5 ${p.val} opacity-80`}>
                                                            {o.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-3xl font-bold ${p.title} flex-shrink-0 ml-3`}>
                                                    {o.discount_type === 'percentage'
                                                        ? o.discount_value + '%'
                                                        : 'Rs.' + Number(o.discount_value).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                {o.promo_code && (
                                                    <span className={`font-mono font-bold px-2 py-0.5 bg-white/70 rounded ${p.title}`}>
                                                        Code: {o.promo_code}
                                                    </span>
                                                )}
                                                {Number(o.min_bill) > 0 && (
                                                    <span className={p.val}>
                                                        Min bill Rs.{Number(o.min_bill).toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                                {o.applies_to !== 'all' && (
                                                    <span className={p.val}>{o.applies_to} only</span>
                                                )}
                                                <span className={p.val}>
                                                    Valid till {new Date(o.end_date).toLocaleDateString('en-IN', {
                                                        day: 'numeric', month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setShowBooking(true)}
                                                className="mt-3 w-full bg-white/80 border border-current py-2 rounded-xl text-xs font-semibold hover:bg-white transition-colors">
                                                Book Now to Avail
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ?? PROFILE TAB ?? */}
                {tab === 'profile' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">My Profile</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-2xl flex-shrink-0">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-lg">{customer.name}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.bg} ${tier.text}`}>
                    {tier.label} Member
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Phone</span>
                  <span className="text-gray-800 font-medium">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-400">Email</span>
                    <span className="text-gray-800">{customer.email}</span>
                  </div>
                )}
                {customer.date_of_birth && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-400">Birthday</span>
                    <span className="text-gray-800">{customer.date_of_birth}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Member since</span>
                  <span className="text-gray-800">
                    {customer.portal_joined
                      ? new Date(customer.portal_joined).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                      : 'Salon member'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Total visits</span>
                  <span className="text-gray-800 font-medium">{customer.total_visits || 0}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Total spent</span>
                  <span className="text-gray-800 font-medium">
                    Rs.{Number(customer.total_spent || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Need help?</h3>
              
                href={'https://wa.me/917006604551'}
  target="_blank"
  rel="noreferrer"
  className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3 hover:bg-green-100 transition-colors">                <div>
                  <div className="text-sm font-medium text-green-700">Contact Bliss Makeover</div>
                  <div className="text-xs text-green-600">WhatsApp us for any queries</div>
                </div>
                <div className="text-green-600 font-bold text-lg">WA</div>
              </a>
            </div>

            <button onClick={onLogout}
              className="w-full border border-red-200 text-red-400 py-3 rounded-2xl text-sm font-medium hover:bg-red-50 transition-colors">
              Sign Out
            </button>
          </div>
        )}
        </div>

      {/* Bottom navigation */ }
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-around px-4 py-2">
            {[
                { key: 'home', label: 'Home' },
                { key: 'appointments', label: 'Bookings' },
                { key: 'loyalty', label: 'Points' },
                { key: 'offers', label: 'Offers' },
                { key: 'profile', label: 'Profile' },
            ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${tab === t.key ? 'text-pink-600' : 'text-gray-400'
                        }`}>
                    <div className={`w-1.5 h-1.5 rounded-full mb-1 ${tab === t.key ? 'bg-pink-600' : 'bg-transparent'}`} />
                    <span className="text-xs font-medium">{t.label}</span>
                </button>
            ))}
        </div>
    </nav>

    {/* Booking modal */ }
    {
        showBooking && (
            <PortalBooking
                customer={customer}
                onClose={() => setShowBooking(false)}
                onBooked={() => { setShowBooking(false); fetchData(); refreshCustomer() }}
            />
        )
    }
    </div >
  )
}