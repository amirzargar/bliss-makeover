import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PIE_COLORS = ['#D4537E', '#185FA5', '#3B6D11', '#854F0B', '#993556', '#2C7BB6']

function StatCard({ label, value, sub, color = 'text-gray-800' }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
            {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
    )
}

export default function Reports() {
    const [loading, setLoading] = useState(true)
    const [monthlyRev, setMonthlyRev] = useState([])
    const [staffPerf, setStaffPerf] = useState([])
    const [topServices, setTopServices] = useState([])
    const [paymentMix, setPaymentMix] = useState([])
    const [tierDist, setTierDist] = useState([])
    const [summary, setSummary] = useState({ totalRevenue: 0, totalDiscount: 0, avgBill: 0, txnCount: 0, newCustomers: 0 })
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

    useEffect(() => { fetchReports() }, [selectedMonth])

    async function fetchReports() {
        setLoading(true)

        const monthStart = `${selectedMonth}-01T00:00:00`
        const [year, month] = selectedMonth.split('-').map(Number)
        const nextMonthStr = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
        const monthEnd = `${nextMonthStr}-01T00:00:00`

        const historyDate = new Date()
        historyDate.setMonth(historyDate.getMonth() - 5)
        const historyStart = historyDate.toISOString().slice(0, 7) + '-01T00:00:00'

        const [txns, allTxns, appts, staff, customers, commissions] = await Promise.all([
            supabase.from('transactions')
                .select('total, discount_amount, payment_mode, created_at, customers(name)')
                .gte('created_at', monthStart)
                .lt('created_at', monthEnd)
                .order('created_at'),

            supabase.from('transactions')
                .select('total, created_at')
                .gte('created_at', historyStart)
                .order('created_at'),

            supabase.from('appointments')
                .select('staff_id, service_id, amount, services(name, category), users(name)')
                .eq('status', 'completed')
                .gte('scheduled_at', monthStart)
                .lt('scheduled_at', monthEnd),

            supabase.from('users').select('id, name, commission_rate').eq('is_active', true),

            supabase.from('customers').select('loyalty_tier, total_visits, created_at'),

            supabase.from('commission_log')
                .select('staff_id, commission_earned, users(name)')
                .eq('month', selectedMonth),
        ])

        const txnData = txns.data || []
        const apptData = appts.data || []
        const custData = customers.data || []

        const totalRevenue = txnData.reduce((s, t) => s + Number(t.total || 0), 0)
        const totalDiscount = txnData.reduce((s, t) => s + Number(t.discount_amount || 0), 0)
        const avgBill = txnData.length ? totalRevenue / txnData.length : 0
        const newCustomers = custData.filter(c =>
            c.created_at?.slice(0, 7) === selectedMonth
        ).length

        setSummary({ totalRevenue, totalDiscount, avgBill, txnCount: txnData.length, newCustomers })

        const revByMonth = {}
            ; (allTxns.data || []).forEach(t => {
                if (!t.created_at) return
                const m = t.created_at.slice(0, 7)
                revByMonth[m] = (revByMonth[m] || 0) + Number(t.total || 0)
            })
        const trend = Object.entries(revByMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, revenue]) => ({
                month: MONTHS[parseInt(month.slice(5, 7)) - 1] + ' ' + month.slice(2, 4),
                revenue: Math.round(revenue),
            }))
        setMonthlyRev(trend)

        const svcMap = {}
        apptData.forEach(a => {
            const name = a.services?.name || 'Unknown'
            if (!svcMap[name]) svcMap[name] = { name, count: 0, revenue: 0, category: a.services?.category || 'General' }
            svcMap[name].count++
            svcMap[name].revenue += Number(a.amount || 0)
        })
        setTopServices(
            Object.values(svcMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 6)
        )

        const staffMap = {}
        apptData.forEach(a => {
            const name = a.users?.name || 'Unassigned'
            const id = a.staff_id || 'unassigned'
            if (!staffMap[id]) staffMap[id] = { name, services: 0, revenue: 0, commission: 0 }
            staffMap[id].services++
            staffMap[id].revenue += Number(a.amount || 0)
        })
            ; (commissions.data || []).forEach(c => {
                const id = c.staff_id
                if (staffMap[id]) {
                    staffMap[id].commission = Number(c.commission_earned || 0)
                }
            })
        setStaffPerf(
            Object.values(staffMap).sort((a, b) => b.revenue - a.revenue)
        )

        const pmMap = {}
        txnData.forEach(t => {
            if (!t.payment_mode) return
            pmMap[t.payment_mode] = (pmMap[t.payment_mode] || 0) + Number(t.total || 0)
        })
        setPaymentMix(
            Object.entries(pmMap).map(([name, value]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                value: Math.round(value),
            }))
        )

        const tierMap = { basic: 0, silver: 0, gold: 0, platinum: 0 }
        custData.forEach(c => { if (c.loyalty_tier && tierMap[c.loyalty_tier] !== undefined) tierMap[c.loyalty_tier]++ })
        setTierDist(
            Object.entries(tierMap).map(([name, value]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                value,
            }))
        )

        setLoading(false)
    }

    function exportCSV() {
        const rows = [
            ['Bliss Makeover - Monthly Report', selectedMonth],
            [],
            ['SUMMARY'],
            ['Total Revenue', `Rs.${(summary.totalRevenue ?? 0).toLocaleString('en-IN')}`],
            ['Total Transactions', summary.txnCount ?? 0],
            ['Average Bill', `Rs.${Math.round(summary.avgBill ?? 0).toLocaleString('en-IN')}`],
            ['Total Discounts Given', `Rs.${(summary.totalDiscount ?? 0).toLocaleString('en-IN')}`],
            ['New Customers', summary.newCustomers ?? 0],
            [],
            ['TOP SERVICES'],
            ['Service', 'Times Done', 'Revenue'],
            ...topServices.map(s => [s.name, s.count, `Rs.${s.revenue.toLocaleString('en-IN')}`]),
            [],
            ['STAFF PERFORMANCE'],
            ['Staff', 'Services Done', 'Revenue Generated', 'Commission'],
            ...staffPerf.map(s => [
                s.name, s.services,
                `Rs.${s.revenue.toLocaleString('en-IN')}`,
                s.commission ? `Rs.${s.commission.toLocaleString('en-IN')}` : '-'
            ]),
        ]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bliss-report-${selectedMonth}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading reports...</div>
    )

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Reports</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Business performance overview</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input type="month" value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
                    <button onClick={exportCSV}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard
                    label="Total revenue"
                    value={`Rs.${Math.round(summary.totalRevenue ?? 0).toLocaleString('en-IN')}`}
                    sub={`${summary.txnCount ?? 0} transactions`}
                    color="text-pink-700" />
                <StatCard
                    label="Average bill"
                    value={`Rs.${Math.round(summary.avgBill ?? 0).toLocaleString('en-IN')}`}
                    sub="per transaction" />
                <StatCard
                    label="Discounts given"
                    value={`Rs.${Math.round(summary.totalDiscount ?? 0).toLocaleString('en-IN')}`}
                    sub="total savings to customers" />
                <StatCard
                    label="New customers"
                    value={summary.newCustomers ?? 0}
                    sub="joined this month" />
                <StatCard
                    label="Services done"
                    value={staffPerf.reduce((s, st) => s + (st.services ?? 0), 0)}
                    sub="completed appointments" />
            </div>

            {/* Revenue trend + Payment mix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue trend (last 6 months)</h2>
                    {monthlyRev.length === 0 ? (
                        <div className="text-center text-gray-300 py-8 text-sm">No data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={monthlyRev}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888780' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#888780' }}
                                    tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={v => [`Rs.${v.toLocaleString('en-IN')}`, 'Revenue']}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #E5E3DC' }} />
                                <Line type="monotone" dataKey="revenue" stroke="#D4537E"
                                    strokeWidth={2} dot={{ fill: '#D4537E', r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment methods</h2>
                    {paymentMix.length === 0 ? (
                        <div className="text-center text-gray-300 py-8 text-sm">No data yet</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={paymentMix} cx="50%" cy="50%" innerRadius={40}
                                        outerRadius={65} dataKey="value" paddingAngle={3}>
                                        {paymentMix.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={v => [`Rs.${v.toLocaleString('en-IN')}`, '']}
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5 mt-2">
                                {paymentMix.map((p, i) => (
                                    <div key={p.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            <span className="text-gray-600">{p.name}</span>
                                        </div>
                                        <span className="font-medium text-gray-800">
                                            Rs.{p.value.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Top services bar chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Top services by revenue</h2>
                {topServices.length === 0 ? (
                    <div className="text-center text-gray-300 py-8 text-sm">No completed services this month</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={topServices} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#888780' }}
                                    tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                                <YAxis type="category" dataKey="name" width={110}
                                    tick={{ fontSize: 11, fill: '#888780' }} />
                                <Tooltip
                                    formatter={v => [`Rs.${v.toLocaleString('en-IN')}`, 'Revenue']}
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Bar dataKey="revenue" fill="#D4537E" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="space-y-3">
                            {topServices.map((s, i) => (
                                <div key={s.name} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-700
                    text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                                        <div className="text-xs text-gray-400">{s.count} times · {s.category}</div>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-800 flex-shrink-0">
                                        Rs.{s.revenue.toLocaleString('en-IN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Staff performance */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Staff performance this month</h2>
                {staffPerf.length === 0 ? (
                    <div className="text-center text-gray-300 py-8 text-sm">No data this month</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Staff</th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Services done</th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Revenue generated</th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Commission earned</th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffPerf.map((s, i) => {
                                    const maxRev = staffPerf[0]?.revenue || 1
                                    const pct = Math.round((s.revenue / maxRev) * 100)
                                    return (
                                        <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center
                            justify-center text-pink-700 font-bold text-xs flex-shrink-0">
                                                        {s.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-gray-800">{s.name}</span>
                                                    {i === 0 && (
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                                            Top
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-gray-600">{s.services}</td>
                                            <td className="py-3 px-3 font-medium text-gray-800">
                                                Rs.{s.revenue.toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-3 px-3 text-gray-600">
                                                {s.commission
                                                    ? `Rs.${s.commission.toLocaleString('en-IN')}`
                                                    : '-'}
                                            </td>
                                            <td className="py-3 px-3 w-32">
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-pink-400 rounded-full transition-all"
                                                        style={{ width: pct + '%' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Customer loyalty distribution */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Customer loyalty distribution</h2>
                <div className="grid grid-cols-4 gap-3">
                    {tierDist.map((t, i) => (
                        <div key={t.name} className="text-center">
                            <div className="text-2xl font-semibold text-gray-800">{t.value}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{t.name}</div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                                <div className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${Math.round((t.value / (tierDist.reduce((s, t) => s + t.value, 0) || 1)) * 100)}%`,
                                        background: PIE_COLORS[i]
                                    }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}