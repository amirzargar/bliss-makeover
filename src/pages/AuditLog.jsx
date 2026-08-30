import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuditLog() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(null)

    useEffect(() => { fetchLogs() }, [])

    async function fetchLogs() {
        setLoading(true)
        const { data } = await supabase
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        setLogs(data || [])
        setLoading(false)
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-800">Audit Log</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                    All admin edits and changes � admin view only
                </p>
            </div>

            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : logs.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-gray-400">No edits recorded yet.</p>
                    <p className="text-gray-300 text-sm mt-1">
                        All admin edits will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map(log => {
                        const isOpen = expanded === log.id
                        return (
                            <div key={log.id}
                                className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setExpanded(isOpen ? null : log.id)}
                                    className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.action === 'edit' ? 'bg-blue-400' :
                                                log.action === 'delete' ? 'bg-red-400' : 'bg-green-400'
                                            }`} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-800">
                                                {log.action.charAt(0).toUpperCase() + log.action.slice(1)} on{' '}
                                                <span className="text-blue-600">{log.table_name}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                By {log.changed_by_name || 'Admin'} on{' '}
                                                {new Date(log.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                                {' at '}
                                                {new Date(log.created_at).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                        {isOpen ? 'Hide' : 'Details'}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-gray-100 p-4 space-y-3">
                                        {log.new_values?.edit_reason && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                                <div className="text-xs font-semibold text-blue-700 mb-1">Reason for edit</div>
                                                <div className="text-xs text-blue-600">{log.new_values.edit_reason}</div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                                                    Before
                                                </div>
                                                <div className="bg-red-50 rounded-xl p-3 space-y-1">
                                                    {log.old_values && Object.entries(log.old_values).map(([key, val]) => (
                                                        <div key={key} className="text-xs">
                                                            <span className="text-gray-500">{key}: </span>
                                                            <span className="text-gray-800 font-medium">
                                                                {val === null ? 'null' : String(val)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                                                    After
                                                </div>
                                                <div className="bg-green-50 rounded-xl p-3 space-y-1">
                                                    {log.new_values && Object.entries(log.new_values)
                                                        .filter(([key]) => key !== 'edit_reason')
                                                        .map(([key, val]) => {
                                                            const changed = log.old_values?.[key] !== val
                                                            return (
                                                                <div key={key} className="text-xs">
                                                                    <span className="text-gray-500">{key}: </span>
                                                                    <span className={`font-medium ${changed ? 'text-green-700' : 'text-gray-800'}`}>
                                                                        {val === null ? 'null' : String(val)}
                                                                    </span>
                                                                    {changed && (
                                                                        <span className="text-green-500 ml-1">changed</span>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-400">
                                            Record ID: {log.record_id}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}