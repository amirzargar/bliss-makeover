import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TIERS = {
  basic:    { label: 'Basic',    bg: 'bg-gray-100',  text: 'text-gray-500',  next: 'silver',   nextVisits: 5,  nextSpend: 10000  },
  silver:   { label: 'Silver',   bg: 'bg-gray-200',  text: 'text-gray-600',  next: 'gold',     nextVisits: 12, nextSpend: 25000  },
  gold:     { label: 'Gold',     bg: 'bg-amber-100', text: 'text-amber-700', next: 'platinum', nextVisits: 25, nextSpend: 60000  },
  platinum: { label: 'Platinum', bg: 'bg-pink-100',  text: 'text-pink-700',  next: null,       nextVisits: 0,  nextSpend: 0      },
}

const EVENT_COLORS = {
  earned:   'bg-green-50 text-green-700',
  redeemed: 'bg-red-50 text-red-500',
  bonus:    'bg-amber-50 text-amber-700',
  referral: 'bg-blue-50 text-blue-600',
  expired:  'bg-gray-100 text-gray-400',
}

export default function Loyalty() {
  const [customers, setCustomers] = useState([])
  const [selected,  setSelected]  = useState(null)
  const [events,    setEvents]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadingEv, setLoadingEv] = useState(false)
  const [search,    setSearch]    = useState('')
  const [tierFilter,setTierFilter]= useState('all')
  const [showRedeem,setShowRedeem]= useState(false)
  const [redeemPts, setRedeemPts] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('id,name,phone,loyalty_tier,loyalty_points,total_visits,total_spent')
      .order('loyalty_points', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function fetchEvents(customerId) {
    setLoadingEv(true)
    const { data } = await supabase
      .from('loyalty_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setEvents(data || [])
    setLoadingEv(false)
  }

  function openCustomer(c) {
    setSelected(c)
    fetchEvents(c.id)
    setShowRedeem(false)
    setRedeemPts('')
  }

  async function redeemPoints() {
    const pts = parseInt(redeemPts)
    if (!pts || pts < 100)   return alert('Minimum redemption is 100 points')
    if (pts > selected.loyalty_points) return alert('Not enough points')
    const rupeesOff   = Math.floor(pts / 100) * 10
    const newBalance  = selected.loyalty_points - pts
    setRedeeming(true)

    await supabase.from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', selected.id)

    await supabase.from('loyalty_events').insert({
      customer_id:   selected.id,
      event_type:    'redeemed',
      points:        -pts,
      balance_after: newBalance,
      description:   `Redeemed ${pts} pts for Rs.${rupeesOff} off`,
    })

    setSelected(s => ({ ...s, loyalty_points: newBalance }))
    setCustomers(prev => prev.map(c =>
      c.id === selected.id ? { ...c, loyalty_points: newBalance } : c
    ))
    fetchEvents(selected.id)
    setShowRedeem(false)
    setRedeemPts('')
    setRedeeming(false)
    alert(`Done! Rs.${rupeesOff} discount applied.`)
  }

  async function addBonusPoints(customerId, points, reason) {
    const customer  = customers.find(c => c.id === customerId)
    const newBalance = (customer?.loyalty_points || 0) + points
    await supabase.from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId)
    await supabase.from('loyalty_events').insert({
      customer_id:   customerId,
      event_type:    'bonus',
      points,
      balance_after: newBalance,
      description:   reason,
    })
    fetchCustomers()
    if (selected?.id === customerId) {
      setSelected(s => ({ ...s, loyalty_points: newBalance }))
      fetchEvents(customerId)
    }
  }

  function tierProgress(c) {
    const tier = TIERS[c.loyalty_tier]
    if (!tier?.next) return null
    const visitPct = Math.min(100, Math.round((c.total_visits / tier.nextVisits) * 100))
    const spendPct = Math.min(100, Math.round((Number(c.total_spent) / tier.nextSpend) * 100))
    return { visitPct, spendPct, nextLabel: TIERS[tier.next]?.label,
             visitsLeft: Math.max(0, tier.nextVisits - c.total_visits),
             spendLeft:  Math.max(0, tier.nextSpend  - Number(c.total_spent)) }
  }

  const filtered = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    const matchTier   = tierFilter === 'all' || c.loyalty_tier === tierFilter
    return matchSearch && matchTier
  })

  const totalPoints = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0)

  return (
    <div className="flex gap-4">

      {/*  Left panel */}
      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-800">Loyalty Points</h1>
          <p className="text-sm text-gray-400 mt-0.5">{customers.length} members | {totalPoints.toLocaleString('en-IN')} total points in circulation</p>
        </div>

        {/* Tier summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['basic','silver','gold','platinum'].map(t => {
            const count = customers.filter(c => c.loyalty_tier === t).length
            const tier  = TIERS[t]
            return (
              <div key={t}
                onClick={() => setTierFilter(tierFilter === t ? 'all' : t)}
                className={`${tier.bg} rounded-xl p-3 text-center cursor-pointer transition-opacity ${
                  tierFilter !== 'all' && tierFilter !== t ? 'opacity-40' : ''
                }`}>
                <div className={`text-xl font-semibold ${tier.text}`}>{count}</div>
                <div className={`text-xs ${tier.text}`}>{tier.label}</div>
              </div>
            )
          })}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customer by name or phone..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-pink-300" />

        {/* Customer list */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No customers found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const tier = TIERS[c.loyalty_tier] || TIERS.basic
              const prog = tierProgress(c)
              return (
                <div key={c.id}
                  onClick={() => openCustomer(c)}
                  className={`bg-white rounded-xl border p-3 cursor-pointer hover:border-pink-200 transition-colors ${
                    selected?.id === c.id ? 'border-pink-300 bg-pink-50' : 'border-gray-100'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center
                      text-pink-700 font-bold text-sm flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm truncate">{c.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tier.bg} ${tier.text}`}>
                          {tier.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{c.phone} | {c.total_visits} visits</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-pink-700 text-sm">
                        {(c.loyalty_points || 0).toLocaleString('en-IN')} pts
                      </div>
                      <div className="text-xs text-gray-400">
                        = Rs.{Math.floor((c.loyalty_points || 0) / 100) * 10}
                      </div>
                    </div>
                  </div>
                  {prog && (
                    <div className="mt-2 pl-12">
                      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>Progress to {prog.nextLabel}</span>
                        <span>{prog.visitsLeft} visits | Rs.{prog.spendLeft.toLocaleString('en-IN')} left</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-400 rounded-full transition-all"
                          style={{ width: Math.min(prog.visitPct, prog.spendPct) + '%' }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: Customer loyalty panel  */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-5 self-start sticky top-0 max-h-screen overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center
                text-pink-700 font-bold text-sm">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{selected.name}</div>
                <div className="text-xs text-gray-400">{selected.phone}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500">x</button>
          </div>

          {/* Points balance */}
          <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl p-4 mb-4 text-center">
            <div className="text-3xl font-bold text-pink-700">
              {(selected.loyalty_points || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-pink-500 mt-0.5">loyalty points</div>
            <div className="text-sm font-medium text-pink-700 mt-1">
              Worth Rs.{Math.floor((selected.loyalty_points || 0) / 100) * 10} in discounts
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setShowRedeem(v => !v)}
              className="bg-pink-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-pink-700">
              Redeem Points
            </button>
            <button onClick={() => {
              const pts = parseInt(prompt('Bonus points to add:') || '0')
              const reason = prompt('Reason (e.g. Birthday bonus):') || 'Manual bonus'
              if (pts > 0) addBonusPoints(selected.id, pts, reason)
            }}
              className="border border-pink-200 text-pink-600 py-2 rounded-lg text-xs font-medium hover:bg-pink-50">
              Add Bonus
            </button>
          </div>

          {/* Redeem form */}
          {showRedeem && (
            <div className="bg-pink-50 rounded-xl p-3 mb-4 border border-pink-200">
              <p className="text-xs text-pink-700 font-medium mb-2">
                Redeem points (100 pts = Rs.10 off)
              </p>
              <p className="text-xs text-gray-500 mb-2">
                Min: 100 pts | Max: {selected.loyalty_points} pts
              </p>
              <input type="number" value={redeemPts}
                onChange={e => setRedeemPts(e.target.value)}
                placeholder="Points to redeem"
                min={100} max={selected.loyalty_points} step={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-pink-300 bg-white" />
              {redeemPts >= 100 && (
                <p className="text-xs text-green-600 font-medium mb-2">
                  Customer gets Rs.{Math.floor(parseInt(redeemPts) / 100) * 10} off
                </p>
              )}
              <button onClick={redeemPoints} disabled={redeeming}
                className="w-full bg-pink-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-pink-700 disabled:opacity-40">
                {redeeming ? 'Processing...' : 'Confirm Redemption'}
              </button>
            </div>
          )}

          {/* Tier progress */}
          {(() => {
            const prog = tierProgress(selected)
            if (!prog) return (
              <div className="bg-pink-50 rounded-xl p-3 mb-4 text-center">
                <div className="text-xs font-medium text-pink-700">Platinum Member</div>
                <div className="text-xs text-pink-400 mt-0.5">Highest tier achieved!</div>
              </div>
            )
            return (
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <div className="text-xs font-medium text-gray-600 mb-2">
                  Progress to {prog.nextLabel}
                </div>
                <div className="space-y-1.5">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                      <span>Visits</span>
                      <span>{selected.total_visits} / {TIERS[selected.loyalty_tier]?.nextVisits}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-400 rounded-full" style={{ width: prog.visitPct + '%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                      <span>Spending</span>
                      <span>Rs.{Number(selected.total_spent).toLocaleString('en-IN')} / Rs.{TIERS[selected.loyalty_tier]?.nextSpend?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-400 rounded-full" style={{ width: prog.spendPct + '%' }} />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {prog.visitsLeft} more visits and Rs.{prog.spendLeft.toLocaleString('en-IN')} more spending needed
                </p>
              </div>
            )
          })()}

          {/* Points history */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Points history</div>
            {loadingEv ? (
              <div className="text-xs text-gray-400">Loading...</div>
            ) : events.length === 0 ? (
              <div className="text-xs text-gray-400">No points activity yet.</div>
            ) : (
              <div className="space-y-2">
                {events.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${EVENT_COLORS[e.event_type]}`}>
                      {e.event_type}
                    </span>
                    <span className="flex-1 text-gray-500 truncate">{e.description}</span>
                    <span className={`font-semibold flex-shrink-0 ${e.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {e.points > 0 ? '+' : ''}{e.points}
                    </span>
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