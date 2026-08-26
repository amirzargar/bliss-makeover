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
    const [sourceBreakdown, setSourceBreakdown] = useState({ walkin: 0, prebook: 0, portal: 0 })
    const [productSummary, setProductSummary] = useState({ revenue: 0, profit: 0, cost: 0, count: 0 })
    const [topProducts, setTopProducts] = useState([])
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

    useEffect(() => { fetchReports() }, [selectedMonth])

    async function fetchReports() {
        setLoading(true)

        const monthStart = selectedMonth + '-01T00:00:00'
        const [year, month] = selectedMonth.split('-').map(Number)
        const nextMonthStr = month === 12
            ? (year + 1) + '-01'
            : year + '-' + String(month + 1).padStart(2, '0')
        const monthEnd = nextMonthStr + '-01T00:00:00'

        const historyDate = new Date()
        historyDate.setMonth(historyDate.getMonth() - 5)
        const historyStart = historyDate.toISOString().slice(0, 7) + '-01T00:00:00'

        const [
            txns, allTxns, appts, staff, customers,
            commissions, sourceStats, productSales, productItems
        ] = await Promise.all([
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

            supabase.from('appointments')
                .select('booking_source')
                .gte('scheduled_at', monthStart)
                .lt('scheduled_at', monthEnd),

            // Product sales this month
            supabase.from('product_sales')
                .select('total, total_cost, total_profit, payment_mode, created_at')
                .gte('created_at', monthStart)
                .lt('created_at', monthEnd),

            // Product sale items for top products
            supabase.from('product_sale_items')
                .select('product_name, quantity, total_price, profit, product_sales(created_at)')
                .gte('product_sales.created_at', monthStart),
        ])

        const txnData = txns.data || []
        const apptData = appts.data || []
        const custData = customers.data || []
        const prodSales = productSales.data || []
        const prodItems = productItems.data || []

        // Service revenue summary
        const totalRevenue = txnData.reduce((s, t) => s + Number(t.total || 0), 0)
        const totalDiscount = txnData.reduce((s, t) => s + Number(t.discount_amount || 0), 0)
        const avgBill = txnData.length ? totalRevenue / txnData.length : 0
        const newCustomers = custData.filter(c => c.created_at?.slice(0, 7) === selectedMonth).length
        setSummary({ totalRevenue, totalDiscount, avgBill, txnCount: txnData.length, newCustomers })

        // Product sales summary
        const prodRevenue = prodSales.reduce((s, p) => s + Number(p.total || 0), 0)
        const prodCost = prodSales.reduce((s, p) => s + Number(p.total_cost || 0), 0)
        const prodProfit = prodSales.reduce((s, p) => s + Number(p.total_profit || 0), 0)
        setProductSummary({ revenue: prodRevenue, cost: prodCost, profit: prodProfit, count: prodSales.length })

        // Top products by revenue
        const productMap = {}
        prodItems.forEach(item => {
            if (!item.product_name) return
            if (!productMap[item.product_name]) {
                productMap[item.product_name] = { name: item.product_name, qty: 0, revenue: 0, profit: 0 }
            }
            productMap[item.product_name].qty += Number(item.quantity || 0)
            productMap[item.product_name].revenue += Number(item.total_price || 0)
            productMap[item.product_name].profit += Number(item.profit || 0)
        })
        setTopProducts(
            Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 6)
        )

        // Revenue trend (service only)
        const revByMonth = {}
            ; (allTxns.data || []).forEach(t => {
                if (!t.created_at) return
                const m = t.created_at.slice(0, 7)
                revByMonth[m] = (revByMonth[m] || 0) + Number(t.total || 0)
            })
        const trend = Object.entries(revByMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([m, revenue]) => ({
                month: MONTHS[parseInt(m.slice(5, 7)) - 1] + ' ' + m.slice(2, 4),
                revenue: Math.round(revenue),
            }))
        setMonthlyRev(trend)

        // Top services
        const svcMap = {}
        apptData.forEach(a => {
            const name = a.services?.name || 'Unknown'
            if (!svcMap[name]) svcMap[name] = { name, count: 0, revenue: 0, category: a.services?.category || 'General' }
            svcMap[name].count++
            svcMap[name].revenue += Number(a.amount || 0)
        })
        setTopServices(Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6))

        // Staff performance
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
                if (staffMap[id]) staffMap[id].commission = Number(c.commission_earned || 0)
            })
        setStaffPerf(Object.values(staffMap).sort((a, b) => b.revenue - a.revenue))

        // Payment mix
        const pmMap = {}
        txnData.forEach(t => {
            if (!t.payment_mode) return
            pmMap[t.payment_mode] = (pmMap[t.payment_mode] || 0) + Number(t.total || 0)
        })
        setPaymentMix(Object.entries(pmMap).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: Math.round(value),
        })))

        // Tier distribution
        const tierMap = { basic: 0, silver: 0, gold: 0, platinum: 0 }
        custData.forEach(c => {
            if (c.loyalty_tier && tierMap[c.loyalty_tier] !== undefined) tierMap[c.loyalty_tier]++
        })
        setTierDist(Object.entries(tierMap).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1), value
        })))

        // Booking source
        const sourceData = sourceStats.data || []
        const walkinCount = sourceData.filter(a => a.booking_source === 'walk_in').length
        const prebookCount = sourceData.filter(a => a.booking_source === 'staff' || !a.booking_source).length
        const portalCount = sourceData.filter(a => a.booking_source === 'portal').length
        setSourceBreakdown({ walkin: walkinCount, prebook: prebookCount, portal: portalCount })

        setLoading(false)
    }

    function exportCSV() {
        const rows = [
            ['Bliss Makeover - Monthly Report', selectedMonth],
            [],
            ['SERVICE REVENUE SUMMARY'],
            ['Total Revenue', 'Rs.' + (summary.totalRevenue ?? 0).toLocaleString('en-IN')],
            ['Total Transactions', summary.txnCount ?? 0],
            ['Average Bill', 'Rs.' + Math.round(summary.avgBill ?? 0).toLocaleString('en-IN')],
            ['Total Discounts Given', 'Rs.' + (summary.totalDiscount ?? 0).toLocaleString('en-IN')],
            ['New Customers', summary.newCustomers ?? 0],
            [],
            ['PRODUCT SALES SUMMARY'],
            ['Product Revenue', 'Rs.' + Math.round(productSummary.revenue).toLocaleString('en-IN')],
            ['Product Cost', 'Rs.' + Math.round(productSummary.cost).toLocaleString('en-IN')],
            ['Product Profit', 'Rs.' + Math.round(productSummary.profit).toLocaleString('en-IN')],
            ['Total Sales', productSummary.count],
            [],
            ['TOP PRODUCTS'],
            ['Product', 'Qty Sold', 'Revenue', 'Profit'],
            ...topProducts.map(p => [
                p.name, p.qty,
                'Rs.' + Math.round(p.revenue).toLocaleString('en-IN'),
                'Rs.' + Math.round(p.profit).toLocaleString('en-IN'),
            ]),
            [],
            ['BOOKING SOURCES'],
            ['Walk-ins', sourceBreakdown.walkin],
            ['Pre-booked', sourceBreakdown.prebook],
            ['Portal bookings', sourceBreakdown.portal],
            [],
            ['TOP SERVICES'],
            ['Service', 'Times Done', 'Revenue'],
            ...topServices.map(s => [s.name, s.count, 'Rs.' + s.revenue.toLocaleString('en-IN')]),
            [],
            ['STAFF PERFORMANCE'],
            ['Staff', 'Services Done', 'Revenue Generated', 'Commission'],
            ...staffPerf.map(s => [
                s.name, s.services,
                'Rs.' + s.revenue.toLocaleString('en-IN'),
                s.commission ? 'Rs.' + s.commission.toLocaleString('en-IN') : '-'
            ]),
        ]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'bliss-report-' + selectedMonth + '.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const totalBookings = sourceBreakdown.walkin + sourceBreakdown.prebook + sourceBreakdown.portal
    const combinedRevenue = (summary.totalRevenue || 0) + (productSummary.revenue || 0)
    const prodMargin = productSummary.revenue > 0
        ? Math.round((productSummary.profit / productSummary.revenue) * 100)
        : 0

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

            {/* Combined revenue banner */}
            {productSummary.count > 0 && (
                <div className="bg-gradient-to-r from-pink-600 to-pink-500 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div className="text-xs text-pink-200 mb-1">Total Business Revenue this month</div>
                            <div className="text-3xl font-bold">
                                Rs.{Math.round(combinedRevenue).toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-pink-200 mt-1">
                                Services: Rs.{Math.round(summary.totalRevenue).toLocaleString('en-IN')} +
                                Products: Rs.{Math.round(productSummary.revenue).toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold">
                                    Rs.{Math.round(productSummary.profit).toLocaleString('en-IN')}
                                </div>
                                <div className="text-xs text-pink-200">Product profit</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold">{prodMargin}%</div>
                                <div className="text-xs text-pink-200">Product margin</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Service summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard
                    label="Service revenue"
                    value={'Rs.' + Math.round(summary.totalRevenue ?? 0).toLocaleString('en-IN')}
                    sub={(summary.txnCount ?? 0) + ' transactions'}
                    color="text-pink-700" />
                <StatCard
                    label="Average bill"
                    value={'Rs.' + Math.round(summary.avgBill ?? 0).toLocaleString('en-IN')}
                    sub="per transaction" />
                <StatCard
                    label="Discounts given"
                    value={'Rs.' + Math.round(summary.totalDiscount ?? 0).toLocaleString('en-IN')}
                    sub="total savings" />
                <StatCard
                    label="New customers"
                    value={summary.newCustomers ?? 0}
                    sub="joined this month" />
                <StatCard
                    label="Services done"
                    value={staffPerf.reduce((s, st) => s + (st.services ?? 0), 0)}
                    sub="completed appointments" />
            </div>

            {/* Product sales section */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Product Sales this month</h2>

                {productSummary.count === 0 ? (
                    <div className="text-center text-gray-300 py-6 text-sm">No product sales this month</div>
                ) : (
                    <>
                        {/* Product summary cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="text-xl font-semibold text-gray-800">
                                    {productSummary.count}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">Sales</div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                                <div className="text-xl font-semibold text-blue-700">
                                    Rs.{Math.round(productSummary.revenue).toLocaleString('en-IN')}
                                </div>
                                <div className="text-xs text-blue-500 mt-0.5">Revenue</div>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <div className="text-xl font-semibold text-amber-700">
                                    Rs.{Math.round(productSummary.cost).toLocaleString('en-IN')}
                                </div>
                                <div className="text-xs text-amber-600 mt-0.5">Cost</div>
                            </div>
                            <div className="bg-green-50 rounded-xl p-3 text-center">
                                <div className="text-xl font-semibold text-green-700">
                                    Rs.{Math.round(productSummary.profit).toLocaleString('en-IN')}
                                </div>
                                <div className="text-xs text-green-600 mt-0.5">Profit ({prodMargin}%)</div>
                            </div>
                        </div>

                        {/* Top products */}
                        {topProducts.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Top Products by Revenue
                                </h3>
                                <div className="space-y-2">
                                    {topProducts.map((p, i) => {
                                        const margin = p.revenue > 0
                                            ? Math.round((p.profit / p.revenue) * 100)
                                            : 0
                                        return (
                                            <div key={p.name} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                                                <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                                                    <div className="text-xs text-gray-400">{p.qty} units sold</div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-sm font-semibold text-gray-800">
                                                        Rs.{Math.round(p.revenue).toLocaleString('en-IN')}
                                                    </div>
                                                    {p.profit > 0 && (
                                                        <div className="text-xs text-green-600">
                                                            +Rs.{Math.round(p.profit).toLocaleString('en-IN')} ({margin}%)
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Booking source breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">How customers are booking</h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-semibold text-amber-700">{sourceBreakdown.walkin}</div>
                        <div className="text-xs text-amber-600 mt-0.5">Walk-ins</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-semibold text-gray-700">{sourceBreakdown.prebook}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Pre-booked</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-semibold text-blue-700">{sourceBreakdown.portal}</div>
                        <div className="text-xs text-blue-500 mt-0.5">Portal bookings</div>
                    </div>
                </div>
                {totalBookings > 0 && (
                    <div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                            {sourceBreakdown.walkin > 0 && (
                                <div className="h-full bg-amber-400 transition-all"
                                    style={{ width: Math.round(sourceBreakdown.walkin / totalBookings * 100) + '%' }} />
                            )}
                            {sourceBreakdown.prebook > 0 && (
                                <div className="h-full bg-gray-400 transition-all"
                                    style={{ width: Math.round(sourceBreakdown.prebook / totalBookings * 100) + '%' }} />
                            )}
                            {sourceBreakdown.portal > 0 && (
                                <div className="h-full bg-blue-400 transition-all"
                                    style={{ width: Math.round(sourceBreakdown.portal / totalBookings * 100) + '%' }} />
                            )}
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>Walk-in: {Math.round(sourceBreakdown.walkin / totalBookings * 100)}%</span>
                            <span>Pre-booked: {Math.round(sourceBreakdown.prebook / totalBookings * 100)}%</span>
                            <span>Portal: {Math.round(sourceBreakdown.portal / totalBookings * 100)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Revenue trend + Payment mix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Service revenue trend (last 6 months)</h2>
                    {monthlyRev.length === 0 ? (
                        <div className="text-center text-gray-300 py-8 text-sm">No data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={monthlyRev}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888780' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#888780' }}
                                    tickFormatter={v => 'Rs.' + (v / 1000).toFixed(0) + 'k'} />
                                <Tooltip
                                    formatter={v => ['Rs.' + v.toLocaleString('en-IN'), 'Revenue']}
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
                                        formatter={v => ['Rs.' + v.toLocaleString('en-IN'), '']}
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

            {/* Top services */}
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
                                    tickFormatter={v => 'Rs.' + (v / 1000).toFixed(0) + 'k'} />
                                <YAxis type="category" dataKey="name" width={110}
                                    tick={{ fontSize: 11, fill: '#888780' }} />
                                <Tooltip
                                    formatter={v => ['Rs.' + v.toLocaleString('en-IN'), 'Revenue']}
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Bar dataKey="revenue" fill="#D4537E" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="space-y-3">
                            {topServices.map((s, i) => (
                                <div key={s.name} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                                        <div className="text-xs text-gray-400">{s.count} times - {s.category}</div>
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
                                                    <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-xs flex-shrink-0">
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
                                                {s.commission ? 'Rs.' + s.commission.toLocaleString('en-IN') : '-'}
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
                                        width: Math.round((t.value / (tierDist.reduce((s, t) => s + t.value, 0) || 1)) * 100) + '%',
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