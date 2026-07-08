import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Appointments() {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        fetchAppointments()
    }, [filterDate])

    async function fetchAppointments() {
        setLoading(true)
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('date', filterDate)
            .order('time', { ascending: true })

        if (error) {
            alert('Failed to clear or load appointments data.')
        } else {
            setAppointments(data || [])
        }
        setLoading(false)
    }

    async function updateStatus(id, nextStatus) {
        const { error } = await supabase
            .from('appointments')
            .update({ status: nextStatus })
            .eq('id', id)

        if (error) {
            alert('Could not update status.')
        } else {
            fetchAppointments()
        }
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Daily Appointments</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Manage schedules and active walk-ins</p>
                </div>
                <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pink-300 self-start sm:self-auto"
                />
            </div>

            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading schedules...</div>
            ) : appointments.length === 0 ? (
                <div className="text-center text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
                    No bookings found for this date.
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-semibold uppercase">
                                    <th className="p-4">Time</th>
                                    <th className="p-4">Client</th>
                                    <th className="p-4">Service</th>
                                    <th className="p-4">Staff Assigned</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-gray-700">
                                {appointments.map(apt => (
                                    <tr key={apt.id} className="hover:bg-gray-50/50">
                                        <td className="p-4 font-medium font-mono text-xs">{apt.time}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{apt.client_name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{apt.client_phone}</div>
                                        </td>
                                        <td className="p-4">{apt.service_title}</td>
                                        <td className="p-4 text-gray-500">{apt.staff_name || 'Unassigned'}</td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${apt.status === 'completed' ? 'bg-green-50 text-green-600' :
                                                    apt.status === 'cancelled' ? 'bg-red-50 text-red-400' :
                                                        'bg-amber-50 text-amber-600'
                                                }`}>
                                                {apt.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {apt.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => updateStatus(apt.id, 'completed')}
                                                        className="text-xs text-green-600 hover:underline font-medium"
                                                    >
                                                        Complete
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(apt.id, 'cancelled')}
                                                        className="text-xs text-red-400 hover:underline font-medium"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}