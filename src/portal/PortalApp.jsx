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

    if (!customer) return (
        <PortalLogin onLogin={handleLogin} />
    )

    return (
        <>
            <PortalDashboard
                customer={customer}
                onLogout={handleLogout}
                onCustomerUpdate={setCustomer}
            />
            <PortalInstallPrompt />
        </>
    )
}

function PortalInstallPrompt() {
    const [prompt, setPrompt] = useState(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault()
            setPrompt(e)
            setShow(true)
        })
    }, [])

    async function install() {
        if (!prompt) return
        prompt.prompt()
        const result = await prompt.userChoice
        if (result.outcome === 'accepted') setShow(false)
    }

    if (!show) return null

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-2xl border border-pink-200 shadow-lg p-4 z-50">
            <div className="flex items-start gap-3">
                <img
                    src="/icons/icon-192x192.png"
                    alt="Bliss"
                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">Install Bliss Makeover</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        Add to your home screen for quick access
                    </div>
                </div>
                <button onClick={() => setShow(false)}
                    className="text-gray-300 hover:text-gray-500 flex-shrink-0 font-bold">
                    x
                </button>
            </div>
            <div className="flex gap-2 mt-3">
                <button onClick={() => setShow(false)}
                    className="flex-1 border border-gray-200 text-gray-500 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                    Not now
                </button>
                <button onClick={install}
                    className="flex-1 bg-pink-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-pink-700">
                    Install App
                </button>
            </div>
        </div>
    )
}