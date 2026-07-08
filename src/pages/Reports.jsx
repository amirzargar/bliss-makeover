import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Reports() {
    const [metrics, setMetrics] = useState({ revenue: 0, appointmentsCount: 0, topServices: [] })
    const [loading, setLoading] = useState(true)
    const [timeframe, setTimeframe] = useState('30')

    useEffect(() => {
        calculateReports()
    }, [timeframe])

    async function calculateReports() {
        setLoading(true)

        const { data: apts, error } = await supabase
            .from('appointments')
            .select('price, service_title, status')
            .eq('status', 'completed')

        if (error) {
            alert('Could not compile report summaries.')
        } else {
            const totalRevenue = (apts || []).reduce((sum, item) => sum + Number(item.price || 0), 0)

            const serviceCounts = {}
                (apts || []).forEach(a => {
                    serviceCounts[a.service_title] = (serviceCounts[a.service_title] || 0) + 1
                })

            const sortedServices = Object.entries(serviceCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)

            setMetrics({
                revenue: totalRevenue,
                appointmentsCount: (apts || []).length,
                topServices: sortedServices
            })
        }
        setLoading(false)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Business Reports</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Overview of salon performance indices</p>
                </div>
                <select
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pink-300"
                >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">This Quarter</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center text-gray-400 py-12">Compiling calculations...</div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Gross Income</span>
                            <span className="text-3xl font-bold text-gray-800 mt-1 block">
                                Rs.{metrics.revenue.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Completed Services</span>
                            <span className="text-3xl font-bold text-gray-800 mt-1 block">
                                {metrics.appointmentsCount}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4">Most Popular Bookings</h3>
                        {metrics.topServices.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No historical trends available yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {metrics.topServices.map((srv, idx) => (
                                    <div key={srv.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold font-mono text-gray-300 text-xs w-4">0{idx + 1}</span>
                                            <span className="text-gray-700 font-medium">{srv.name}</span>
                                        </div>
                                        <span className="text-gray-400 text-xs font-mono">{srv.count} sessions</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}