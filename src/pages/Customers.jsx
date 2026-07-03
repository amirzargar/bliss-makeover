import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TIERS = {
  basic:    { label: 'Basic',    bg: 'bg-gray-100',   text: 'text-gray-500' },
  silver:   { label: 'Silver',   bg: 'bg-gray-200',   text: 'text-gray-600' },
  gold:     { label: 'Gold',     bg: 'bg-amber-100',  text: 'text-amber-700' },
  platinum: { label: 'Platinum', bg: 'bg-pink-100',   text: 'text-pink-700' },
}

const empty = { name:'', phone:'', email:'', date_of_birth:'', notes:'' }

export default function Customers() {
  const [customers,  setCustomers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [selected,   setSelected]   = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(empty)
  const [saving,     setSaving]     = useState(false)
  const [history,    setHistory]    = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  async function fetchHistory(customerId) {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('appointments')
      .select('*, services(name, category), users(name)')
      .eq('customer_id', customerId)
      .order('scheduled_at', { ascending: false })
      .limit(10)
    setHistory(data || [])
    setLoadingHistory(false)
  }

  function openProfile(c) {
    setSelected(c)
    fetchHistory(c.id)
  }

  async function save() {
    if (!form.name.trim()) return alert('Enter customer name')
    if (!form.phone.trim()) return alert('Enter phone number')
    setSaving(true)
    const { error } = await supabase.from('customers').insert(form)
    if (error) alert('Error: ' + error.message)
    else { setShowForm(false); setForm(empty); fetchCustomers() }
    setSaving(false)
  }

  async function deleteCustomer(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    await supabase.from('customers').delete().eq('id', id)
    setSelected(null)
    fetchCustomers()
  }

  const filtered = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    const matchTier = tierFilter === 'all' || c.loyalty_tier === tierFilter
    return matchSearch && matchTier
  })

  return (
    <div className="flex gap-4 h-full">

      {/* Left: Customer list  */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Customers</h1>
            <p className="text-sm text-gray-400 mt-0.5">{customers.length} total</p>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true) }}
            className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
            + Add Customer
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 mb-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
            <option value="all">All tiers</option>
            <option value="basic">Basic</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['basic','silver','gold','platinum'].map(t => {
            const count = customers.filter(c => c.loyalty_tier === t).length
            const tier  = TIERS[t]
            return (
              <div key={t} className={`${tier.bg} rounded-xl p-3 text-center cursor-pointer`}
                onClick={() => setTierFilter(tierFilter === t ? 'all' : t)}>
                <div className={`text-lg font-semibold ${tier.text}`}>{count}</div>
                <div className={`text-xs ${tier.text}`}>{tier.label}</div>
              </div>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No customers found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const tier = TIERS[c.loyalty_tier] || TIERS.basic
              return (
                <div key={c.id}
                  onClick={() => openProfile(c)}
                  className={`bg-white rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:border-pink-200 transition-colors ${
                    selected?.id === c.id ? 'border-pink-300 bg-pink-50' : 'border-gray-100'
                  }`}>
                  <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center
                    text-pink-700 font-semibold text-sm flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.bg} ${tier.text}`}>
                      {tier.label}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">{c.total_visits} visits</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/*  Right: Customer profile panel  */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-5 overflow-y-auto self-start sticky top-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center
                text-pink-700 font-bold text-lg">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-800">{selected.name}</div>
                <div className="text-xs text-gray-400">{selected.phone}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-lg">x</button>
          </div>

          {/* Tier badge */}
          <div className="flex gap-2 mb-4">
            <span className={`text-xs px-3 py-1 rounded-full font-medium
              ${TIERS[selected.loyalty_tier]?.bg} ${TIERS[selected.loyalty_tier]?.text}`}>
              {TIERS[selected.loyalty_tier]?.label} Member
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <div className="text-base font-semibold text-gray-800">{selected.total_visits}</div>
              <div className="text-xs text-gray-400">Visits</div>
            </div>
            <div className="bg-pink-50 rounded-xl p-2 text-center">
              <div className="text-base font-semibold text-pink-700">{selected.loyalty_points}</div>
              <div className="text-xs text-gray-400">Points</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <div className="text-base font-semibold text-gray-800">
                Rs.{Number(selected.total_spent).toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-gray-400">Spent</div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm mb-4">
            {selected.email && (
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-gray-700">{selected.email}</span>
              </div>
            )}
            {selected.date_of_birth && (
              <div className="flex justify-between">
                <span className="text-gray-400">Birthday</span>
                <span className="text-gray-700">{selected.date_of_birth}</span>
              </div>
            )}
            {selected.notes && (
              <div>
                <span className="text-gray-400 block mb-1">Notes</span>
                <p className="text-gray-600 text-xs bg-gray-50 rounded-lg p-2">{selected.notes}</p>
              </div>
            )}
          </div>

          {/* Visit history */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Recent visits</div>
            {loadingHistory ? (
              <div className="text-xs text-gray-400">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-gray-400">No visits yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-700 truncate">{h.services?.name}</div>
                      <div className="text-gray-400">
                        {new Date(h.scheduled_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                      ${h.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => deleteCustomer(selected.id)}
            className="mt-5 w-full border border-red-200 text-red-400 py-1.5 rounded-lg
              text-xs hover:bg-red-50 transition-colors">
            Delete customer
          </button>
        </div>
      )}

      {/*  Add Customer Modal  */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Add Customer</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="e.g. Noor Ahmed"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone *</label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  placeholder="e.g. 9419000001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="optional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
                <input type="date" value={form.date_of_birth}
                  onChange={e => setForm(f => ({...f, date_of_birth: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="Preferences, allergies, special notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                  rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                {saving ? 'Saving...' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}