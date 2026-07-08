import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState(null)

    useEffect(() => {
        fetchInventory()
    }, [])

    async function fetchInventory() {
        setLoading(true)
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            alert('Failed to retrieve inventory list.')
        } else {
            setItems(data || [])
        }
        setLoading(false)
    }

    async function adjustStock(id, newStock) {
        if (newStock < 0) return
        setUpdatingId(id)
        const { error } = await supabase
            .from('inventory')
            .update({ stock: Number(newStock) })
            .eq('id', id)

        setUpdatingId(null)
        if (error) {
            alert('Failed to adjust current stock level.')
        } else {
            setItems(prev => prev.map(item => item.id === id ? { ...item, stock: Number(newStock) } : item))
        }
    }

    return (
        <div>
            <div className="mb-5">
                <h1 className="text-xl font-semibold text-gray-800">Salon Inventory</h1>
                <p className="text-sm text-gray-400 mt-0.5">Track products, retail items, and backbar stocks</p>
            </div>

            {loading ? (
                <div className="text-center text-gray-400 py-12">Loading inventory tracks...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => {
                        const isLow = item.stock <= (item.min_threshold || 5)
                        return (
                            <div key={item.id} className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${isLow ? 'border-amber-200 bg-amber-50/10' : 'border-gray-100'
                                }`}>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div>
                                        <h3 className="font-semibold text-sm text-gray-800">{item.name}</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">{item.category || 'General'}</p>
                                    </div>
                                    {isLow && (
                                        <span className="bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                                            Low Stock
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-3">
                                    <div className="text-xs text-gray-500">
                                        Stock level: <span className={`font-mono font-bold text-sm ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>{item.stock}</span> units
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={updatingId === item.id}
                                            onClick={() => adjustStock(item.id, item.stock - 1)}
                                            className="w-7 h-7 bg-gray-100 text-gray-600 rounded flex items-center justify-center font-bold text-sm hover:bg-gray-200 disabled:opacity-40"
                                        >
                                            -
                                        </button>
                                        <button
                                            disabled={updatingId === item.id}
                                            onClick={() => adjustStock(item.id, item.stock + 1)}
                                            className="w-7 h-7 bg-pink-50 text-pink-600 rounded flex items-center justify-center font-bold text-sm hover:bg-pink-100 disabled:opacity-40"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}