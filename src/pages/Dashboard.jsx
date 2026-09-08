import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function Dashboard() {
    const { profile } = useAuthStore()
    const [loading, setLoading] = useState(true)
    const [todayAppts, setTodayAppts] = useState([])
    const [pendingCheckout, setPendingCheckout] = useState([])
    const [portalBookings, setPortalBookings] = useState([])
    const [todayRevenue, setTodayRevenue] = useState(0)
    const [todayProductRev, setTodayProductRev] = useState(0)
    const [monthRevenue, setMonthRevenue] = useState(0)
    const [birthdayAlerts, setBirthdayAlerts] = useState([])
    const [lowStock, setLowStock] = useState([])
    const [staffOnDuty, setStaffOnDuty] = useState([])
    const [monthStats, setMonthStats] = useState({ appointments: 0, newCustomers: 0, portalSignups: 0 })
    const [recentActivity, setRecentActivity] = useState([])
    const [time, setTime] = useState(new Date())

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => { fetchAll() }, [])

    function getTodayLocal() {
        const t = new Date()
        return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    }

    async function fetchAll() {
        setLoading(true)
        const today = getTodayLocal()
        const todayStart = today + 'T00:00:00'
        const todayEnd = today + 'T23:59:59'
        const monthStart = today.slice(0, 7) + '-01T00:00:00'
        const now = new Date()
        const todayMD = (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0')

        const [
            appts, txns, productSales, customers,
            inventory, staff, loyaltyEvents
        ] = await Promise.all([
            supabase.from('appointments')
                .select('*, customers(name,phone,date_of_birth), users(name), services(name,category)')
                .gte('scheduled_at', todayStart)
                .lte('scheduled_at', todayEnd)
                .order('scheduled_at'),

            supabase.from('transactions')
                .select('total, created_at, appointment_id')
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd),

            supabase.from('product_sales')
                .select('total, created_at')
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd),

            supabase.from('customers')
                .select('id, name, phone, date_of_birth, created_at, source, portal_joined')
                .order('created_at', { ascending: false }),

            supabase.from('inventory')
                .select('id, name, stock_qty, min_level')
                .order('name'),

            supabase.from('users')
                .select('id, name, role')
                .eq('is_active', true),

            supabase.from('loyalty_events')
                .select('*, customers(name)')
                .order('created_at', { ascending: false })
                .limit(5),
        ])

        const apptData = appts.data || []
        const txnData = txns.data || []
        const prodData = productSales.data || []
        const custData = customers.data || []
        const invData = inventory.data || []
        const staffData = staff.data || []

        // Today appointments
        setTodayAppts(apptData)

        // Pending checkout - completed but not yet checked out
        const completedIds = txnData.map(t => t.appointment_id).filter(Boolean)
        const pending = apptData.filter(a =>
            a.status === 'completed' && !completedIds.includes(a.id)
        )
        setPendingCheckout(pending)

        // Portal bookings today
        const portal = apptData.filter(a => a.booking_source === 'portal')
        setPortalBookings(portal)

        // Revenue
        const todayRev = txnData.reduce((s, t) => s + Number(t.total || 0), 0)
        const todayProd = prodData.reduce((s, p) => s + Number(p.total || 0), 0)
        setTodayRevenue(todayRev)
        setTodayProductRev(todayProd)

        // Month revenue
        const { data: monthTxns } = await supabase
            .from('transactions')
            .select('total')
            .gte('created_at', monthStart)

        setMonthRevenue((monthTxns || []).reduce((s, t) => s + Number(t.total || 0), 0))

        // Birthday alerts - today
        const birthdays = custData.filter(c => {
            if (!c.date_of_birth) return false
            const dob = c.date_of_birth.slice(5, 10)
            return dob === todayMD
        })
        setBirthdayAlerts(birthdays)

        // Low stock
        const low = invData.filter(i => Number(i.stock_qty) <= Number(i.min_level))
        setLowStock(low)

        // Staff on duty
        setStaffOnDuty(staffData.filter(s => s.role !== 'admin'))

        // Month stats
        const { data: monthAppts } = await supabase
            .from('appointments')
            .select('id')
            .gte('scheduled_at', monthStart)

        const newThisMonth = custData.filter(c => c.created_at?.startsWith(today.slice(0, 7))).length
        const portalThisMonth = custData.filter(c => c.portal_joined?.startsWith(today.slice(0, 7))).length

        setMonthStats({
            appointments: (monthAppts || []).length,
            newCustomers: newThisMonth,
            portalSignups: portalThisMonth,
        })

        // Recent activity feed
        const activity = [
            ...txnData.map(t => ({
                type: 'checkout',
                time: t.created_at,
                text: 'Checkout - Rs.' + Number(t.total).toLocaleString('en-IN'),
            })),

            ...apptData.filter(a => a.booking_source === 'portal').map(a => ({
                type: 'portal',
                time: a.scheduled_at,
                text: 'Portal booking - ' + (a.customers?.name || 'Customer'),
            })),

            ...(loyaltyEvents.data || []).map(e => ({
                type: 'loyalty',
                time: e.created_at,
                text: (e.customers?.name || 'Customer') + ' ' +
                    (e.points > 0 ? 'earned ' + e.points + ' pts' : 'redeemed ' + Math.abs(e.points) + ' pts'),
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)

        setRecentActivity(activity)

        setLoading(false)
    }

    const totalTodayRev = todayRevenue + todayProductRev

    const statusCounts = {
        confirmed: todayAppts.filter(a => a.status === 'confirmed').length,
        in_progress: todayAppts.filter(a => a.status === 'in_progress').length,
        completed: todayAppts.filter(a => a.status === 'completed').length,
        cancelled: todayAppts.filter(a => a.status === 'cancelled').length,
    }

    const greet = () => {
        const h = time.getHours()
        if (h < 12) return 'Good morning'
        if (h < 17) return 'Good afternoon'
        return 'Good evening'
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-gray-400">
            Loading dashboard...
        </div>
    )

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">
                        {greet()}, {profile?.name?.split(' ')[0]}!
                    </h1>

                    <p className="text-sm text-gray-400 mt-0.5">
                        {time.toLocaleDateString('en-IN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                        {' - '}
                        {time.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}
                    </p>
                </div>

                <button
                    onClick={fetchAll}
                    className="text-xs text-pink-500 border border-pink-200 px-3 py-1.5 rounded-lg hover:bg-pink-50 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Alerts row */}
            {(birthdayAlerts.length > 0 ||
                pendingCheckout.length > 0 ||
                portalBookings.length > 0 ||
                lowStock.length > 0) && (

                    <div className="space-y-2">

                        {birthdayAlerts.map(c => (
                            <div
                                key={c.id}
                                className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 flex items-center gap-3"
                            >
                                <span className="text-xl">[BIRTHDAY]</span>

                                <div className="flex-1">
                                    <span className="font-medium text-pink-700 text-sm">
                                        {c.name}
                                    </span>

                                    <span className="text-pink-500 text-sm">
                                        {' '}has a birthday today!
                                    </span>
                                </div>

                                <button
                                    onClick={() => {
                                        const msg =
                                            'Hi ' + c.name +
                                            '! Wishing you a very Happy Birthday from all of us at Bliss Makeover! May your day be as beautiful as you are. We have a special surprise waiting for you!'

                                        const phone = (c.phone || '').replace(/\D/g, '')
                                        const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone

                                        window.open(
                                            'https://wa.me/' +
                                            phoneWithCode +
                                            '?text=' +
                                            encodeURIComponent(msg),
                                            '_blank'
                                        )
                                    }}
                                    className="text-xs bg-pink-600 text-white px-3 py-1.5 rounded-lg hover:bg-pink-700 flex-shrink-0"
                                >
                                    Send Wishes
                                </button>
                            </div>
                        ))}

                        {pendingCheckout.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="text-xl">[PAYMENT]</span>

                                <div className="flex-1">
                                    <span className="font-medium text-amber-700 text-sm">
                                        {pendingCheckout.length} appointment{pendingCheckout.length > 1 ? 's' : ''} pending checkout
                                    </span>

                                    <div className="text-xs text-amber-600 mt-0.5">
                                        {pendingCheckout.map(a => a.customers?.name).join(', ')}
                                    </div>
                                </div>

                                <a
                                    href="/appointments"
                                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 flex-shrink-0"
                                >
                                    Go to Appointments
                                </a>
                            </div>
                        )}

                        {portalBookings.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="text-xl">[PORTAL]</span>

                                <div className="flex-1">
                                    <span className="font-medium text-blue-700 text-sm">
                                        {portalBookings.length} new portal booking{portalBookings.length > 1 ? 's' : ''} today
                                    </span>

                                    <div className="text-xs text-blue-600 mt-0.5">
                                        {portalBookings.map(a => a.customers?.name).join(', ')}
                                    </div>
                                </div>

                                <a
                                    href="/appointments"
                                    className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 flex-shrink-0"
                                >
                                    View
                                </a>
                            </div>
                        )}

                        {lowStock.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="text-xl"></span>

                                <div className="flex-1">
                                    <span className="font-medium text-red-700 text-sm">
                                        {lowStock.length} product{lowStock.length > 1 ? 's' : ''} low on stock
                                    </span>

                                    <div className="text-xs text-red-500 mt-0.5">
                                        {lowStock.slice(0, 3).map(i => i.name).join(', ')}
                                        {lowStock.length > 3 && ' +' + (lowStock.length - 3) + ' more'}
                                    </div>
                                </div>

                                <a
                                    href="/inventory"
                                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex-shrink-0"
                                >
                                    View Stock
                                </a>
                            </div>
                        )}

                    </div>
                )}

            {/* Today revenue cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <div className="bg-gradient-to-br from-pink-600 to-pink-500 rounded-2xl p-4 text-white">
                    <div className="text-xs text-pink-200 mb-1">
                        Today's Revenue
                    </div>

                    <div className="text-2xl font-bold">
                        Rs.{Math.round(totalTodayRev).toLocaleString('en-IN')}
                    </div>

                    <div className="text-xs text-pink-200 mt-1">
                        Services + Products
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 mb-1">
                        Month Revenue
                    </div>

                    <div className="text-2xl font-semibold text-gray-800">
                        Rs.{Math.round(monthRevenue).toLocaleString('en-IN')}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                        {monthStats.appointments} appointments
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 mb-1">
                        Today's Appointments
                    </div>

                    <div className="text-2xl font-semibold text-gray-800">
                        {todayAppts.length}
                    </div>

                    <div className="flex gap-2 mt-1">
                        {statusCounts.in_progress > 0 && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                {statusCounts.in_progress} active
                            </span>
                        )}

                        {statusCounts.completed > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                {statusCounts.completed} done
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 mb-1">
                        New This Month
                    </div>

                    <div className="text-2xl font-semibold text-gray-800">
                        {monthStats.newCustomers}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                        {monthStats.portalSignups} via portal
                    </div>
                </div>

            </div>

            {/* Today appointment status breakdown */}
            {todayAppts.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">

                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-700">
                            Today at a Glance
                        </h2>

                        <a
                            href="/appointments"
                            className="text-xs text-pink-500 hover:text-pink-700"
                        >
                            View all
                        </a>
                    </div>

                    {/* Status bar */}
                    {todayAppts.length > 0 && (
                        <div className="mb-4">

                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-2">

                                {statusCounts.completed > 0 && (
                                    <div
                                        className="h-full bg-green-400 transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    statusCounts.completed /
                                                    todayAppts.length *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                                {statusCounts.in_progress > 0 && (
                                    <div
                                        className="h-full bg-amber-400 transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    statusCounts.in_progress /
                                                    todayAppts.length *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                                {statusCounts.confirmed > 0 && (
                                    <div
                                        className="h-full bg-blue-300 transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    statusCounts.confirmed /
                                                    todayAppts.length *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                                {statusCounts.cancelled > 0 && (
                                    <div
                                        className="h-full bg-red-300 transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    statusCounts.cancelled /
                                                    todayAppts.length *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                            </div>

                            <div className="flex gap-4 text-xs text-gray-500 flex-wrap">

                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    {statusCounts.completed} completed
                                </span>

                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    {statusCounts.in_progress} in progress
                                </span>

                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-300" />
                                    {statusCounts.confirmed} confirmed
                                </span>

                                {statusCounts.cancelled > 0 && (
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-300" />
                                        {statusCounts.cancelled} cancelled
                                    </span>
                                )}

                            </div>
                        </div>
                    )}

                    {/* Appointment list */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">

                        {todayAppts.map(a => {

                            const statusColors = {
                                confirmed: 'bg-blue-50 text-blue-700',
                                in_progress: 'bg-amber-50 text-amber-700',
                                completed: 'bg-green-50 text-green-700',
                                cancelled: 'bg-red-50 text-red-400',
                                no_show: 'bg-gray-100 text-gray-400',
                            }

                            return (
                                <div
                                    key={a.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                                >

                                    <div className="text-xs font-bold text-gray-500 w-14 flex-shrink-0">
                                        {new Date(a.scheduled_at).toLocaleTimeString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    <div className="flex-1 min-w-0">

                                        <div className="text-sm font-medium text-gray-800 truncate">
                                            {a.customers?.name}
                                        </div>

                                        <div className="text-xs text-gray-400 truncate">
                                            {a.services_summary || a.services?.name}
                                            {a.users?.name && ' - ' + a.users.name}
                                        </div>

                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">

                                        <span className="text-xs font-medium text-gray-700">
                                            Rs.{Number(a.amount || 0).toLocaleString('en-IN')}
                                        </span>

                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status]}`}
                                        >
                                            {a.status.replace('_', ' ')}
                                        </span>

                                    </div>

                                </div>
                            )
                        })}

                    </div>
                </div>
            )}

            {/* Staff on duty + Recent activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Staff on duty */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">

                    <h2 className="text-sm font-semibold text-gray-700 mb-3">
                        Staff on Duty
                    </h2>

                    {staffOnDuty.length === 0 ? (
                        <p className="text-xs text-gray-400">
                            No staff configured.
                        </p>
                    ) : (

                        <div className="space-y-2">

                            {staffOnDuty.map(s => {

                                const apptCount =
                                    todayAppts.filter(
                                        a => a.staff_id === s.id
                                    ).length

                                const doneCount =
                                    todayAppts.filter(
                                        a =>
                                            a.staff_id === s.id &&
                                            a.status === 'completed'
                                    ).length

                                const revenue =
                                    todayAppts
                                        .filter(
                                            a =>
                                                a.staff_id === s.id &&
                                                a.status === 'completed'
                                        )
                                        .reduce(
                                            (sum, a) =>
                                                sum + Number(a.amount || 0),
                                            0
                                        )

                                return (
                                    <div
                                        key={s.id}
                                        className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
                                    >

                                        <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">
                                            {s.name.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0">

                                            <div className="text-sm font-medium text-gray-800">
                                                {s.name}
                                            </div>

                                            <div className="text-xs text-gray-400">
                                                {apptCount} appointments today - {doneCount} done
                                            </div>

                                        </div>

                                        {revenue > 0 && (
                                            <div className="text-xs font-semibold text-green-600 flex-shrink-0">
                                                Rs.{Math.round(revenue).toLocaleString('en-IN')}
                                            </div>
                                        )}

                                    </div>
                                )
                            })}

                        </div>
                    )}

                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">

                    <h2 className="text-sm font-semibold text-gray-700 mb-3">
                        Recent Activity
                    </h2>

                    {recentActivity.length === 0 ? (
                        <p className="text-xs text-gray-400">
                            No activity today yet.
                        </p>
                    ) : (

                        <div className="space-y-2">

                            {recentActivity.map((item, i) => {

                                const icons = {
                                    checkout: '[CHECKOUT]',
                                    portal: '[PORTAL]',
                                    
                                }

                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3"
                                    >

                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">
                                            {icons[item.type] || '-'}
                                        </div>

                                        <div className="flex-1 min-w-0">

                                            <div className="text-xs text-gray-700 truncate">
                                                {item.text}
                                            </div>

                                            <div className="text-xs text-gray-400">
                                                {new Date(item.time).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>

                                        </div>

                                    </div>
                                )
                            })}

                        </div>
                    )}

                </div>

            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">

                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    Quick Actions
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                    {[
                        {
                            label: 'Book Appointment',
                            href: '/appointments',
                            color: 'bg-pink-600'
                        },
                        {
                            label: 'New Product Sale',
                            href: '/product-sales',
                            color: 'bg-blue-500'
                        },
                        {
                            label: 'Add Customer',
                            href: '/customers',
                            color: 'bg-green-500'
                        },
                        {
                            label: 'View Reports',
                            href: '/reports',
                            color: 'bg-amber-500'
                        },
                    ].map(action => (

                        <a
                            key={action.label}
                            href={action.href}
                            className={`${action.color} text-white py-3 px-4 rounded-xl text-xs font-semibold text-center hover:opacity-90 transition-opacity`}
                        >
                            {action.label}
                        </a>

                    ))}

                </div>
            </div>

            {/* Today revenue breakdown */}
            {(todayRevenue > 0 || todayProductRev > 0) && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">

                    <h2 className="text-sm font-semibold text-gray-700 mb-3">
                        Today Revenue Breakdown
                    </h2>

                    <div className="grid grid-cols-2 gap-3">

                        <div className="bg-pink-50 rounded-xl p-3 text-center">

                            <div className="text-xl font-bold text-pink-700">
                                Rs.{Math.round(todayRevenue).toLocaleString('en-IN')}
                            </div>

                            <div className="text-xs text-pink-500 mt-0.5">
                                From Services
                            </div>

                        </div>

                        <div className="bg-blue-50 rounded-xl p-3 text-center">

                            <div className="text-xl font-bold text-blue-700">
                                Rs.{Math.round(todayProductRev).toLocaleString('en-IN')}
                            </div>

                            <div className="text-xs text-blue-500 mt-0.5">
                                From Products
                            </div>

                        </div>

                    </div>

                    {totalTodayRev > 0 && (
                        <div className="mt-3">

                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">

                                {todayRevenue > 0 && (
                                    <div
                                        className="h-full bg-pink-400 rounded-l-full transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    todayRevenue /
                                                    totalTodayRev *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                                {todayProductRev > 0 && (
                                    <div
                                        className="h-full bg-blue-400 rounded-r-full transition-all"
                                        style={{
                                            width:
                                                Math.round(
                                                    todayProductRev /
                                                    totalTodayRev *
                                                    100
                                                ) + '%'
                                        }}
                                    />
                                )}

                            </div>

                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>
                                    Services: {Math.round(todayRevenue / totalTodayRev * 100)}%
                                </span>

                                <span>
                                    Products: {Math.round(todayProductRev / totalTodayRev * 100)}%
                                </span>
                            </div>

                        </div>
                    )}

                </div>
            )}

        </div>
    )
}