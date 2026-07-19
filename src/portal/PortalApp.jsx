import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PortalLogin    from './PortalLogin'
import PortalDashboard from './PortalDashboard'

export default function PortalApp() {
  const [customer, setCustomer] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const token = localStorage.getItem('portal_token')
    if (!token) { setLoading(false); return }

    const { data } = await supabase
      .from('customer_sessions')
      .select('*, customers(*)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (data?.customers) {
      setCustomer(data.customers)
    } else {
      localStorage.removeItem('portal_token')
    }
    setLoading(false)
  }

  async function handleLogin(customerData, token) {
    localStorage.setItem('portal_token', token)
    setCustomer(customerData)
  }

  async function handleLogout() {
    const token = localStorage.getItem('portal_token')
    if (token) {
      await supabase.from('customer_sessions').delete().eq('token', token)
    }
    localStorage.removeItem('portal_token')
    setCustomer(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center">
      <div className="text-pink-600 text-sm">Loading...</div>
    </div>
  )

  if (!customer) return (
    <PortalLogin onLogin={handleLogin} />
  )

  return (
    <PortalDashboard
      customer={customer}
      onLogout={handleLogout}
      onCustomerUpdate={setCustomer}
    />
  )
}