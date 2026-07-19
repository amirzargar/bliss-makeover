import { useState } from 'react'
import { supabase } from '../lib/supabase'

function generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

function hashPassword(password) {
    // Simple but consistent hash for demo
    // In production use bcrypt via edge function
    let hash = 0
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

export default function PortalLogin({ onLogin }) {
    const [mode, setMode] = useState('login') // login | signup | claim | forgot
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')

    async function handleLogin() {
        if (!phone.trim() && !email.trim()) return setError('Enter your phone or email')
        if (!password.trim()) return setError('Enter your password')
        setLoading(true)
        setError('')

        const hashed = hashPassword(password)

        let query = supabase.from('customers').select('*').eq('portal_password', hashed)
        if (phone.trim()) {
            query = query.eq('phone', phone.trim())
        } else {
            query = query.eq('email', email.trim().toLowerCase())
        }

        const { data } = await query.single()

        if (!data) {
            setError('Invalid phone/email or password. If you forgot your password, use the link below.')
            setLoading(false)
            return
        }

        if (!data.portal_active) {
            setError('Your account is not active. Please contact the salon.')
            setLoading(false)
            return
        }

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await supabase.from('customer_sessions').insert({
            customer_id: data.id,
            token,
            expires_at: expiresAt,
        })

        setLoading(false)
        onLogin(data, token)
    }

    async function handleSignup() {
        if (!name.trim()) return setError('Enter your name')
        if (!phone.trim()) return setError('Enter your phone number')
        if (!password.trim()) return setError('Choose a password')
        if (password !== confirm) return setError('Passwords do not match')
        if (password.length < 6) return setError('Password must be at least 6 characters')
        setLoading(true)
        setError('')

        // Check if phone already exists
        const { data: existing } = await supabase
            .from('customers')
            .select('id, portal_password')
            .eq('phone', phone.trim())
            .single()

        if (existing) {
            if (existing.portal_password) {
                setError('An account with this phone already exists. Please log in.')
            } else {
                setError('You are already registered at our salon. Click "Already visited us?" to set your password.')
            }
            setLoading(false)
            return
        }

        const hashed = hashPassword(password)

        const { data: newCustomer, error: err } = await supabase
            .from('customers')
            .insert({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase() || null,
                portal_password: hashed,
                portal_active: true,
                source: 'portal',
                portal_joined: new Date().toISOString(),
            })
            .select()
            .single()

        if (err) {
            setError('Could not create account: ' + err.message)
            setLoading(false)
            return
        }

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await supabase.from('customer_sessions').insert({
            customer_id: newCustomer.id,
            token,
            expires_at: expiresAt,
        })

        setLoading(false)
        onLogin(newCustomer, token)
    }

    async function handleClaim() {
        if (!phone.trim()) return setError('Enter your registered phone number')
        if (!password.trim()) return setError('Choose a new password')
        if (password !== confirm) return setError('Passwords do not match')
        if (password.length < 6) return setError('Password must be at least 6 characters')
        setLoading(true)
        setError('')

        const { data: existing } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', phone.trim())
            .single()

        if (!existing) {
            setError('No account found with this phone number. Please sign up instead.')
            setLoading(false)
            return
        }

        if (existing.portal_password) {
            setError('This account already has a password. Please log in or use forgot password.')
            setLoading(false)
            return
        }

        const hashed = hashPassword(password)

        await supabase.from('customers').update({
            portal_password: hashed,
            portal_active: true,
            portal_joined: new Date().toISOString(),
        }).eq('id', existing.id)

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await supabase.from('customer_sessions').insert({
            customer_id: existing.id,
            token,
            expires_at: expiresAt,
        })

        setLoading(false)
        onLogin({ ...existing, portal_password: hashed }, token)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-pink-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="text-3xl font-bold text-pink-700 mb-1">Bliss Makeover</div>
                    <div className="text-sm text-gray-400">Hair | Makeup | Skin</div>
                    <div className="text-xs text-pink-400 mt-2 font-medium">Customer Portal</div>
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
                    <button
                        onClick={() => { setMode('login'); setError('') }}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode === 'login' ? 'bg-white text-pink-700 shadow-sm' : 'text-gray-500'
                            }`}>
                        Sign In
                    </button>
                    <button
                        onClick={() => { setMode('signup'); setError('') }}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode === 'signup' ? 'bg-white text-pink-700 shadow-sm' : 'text-gray-500'
                            }`}>
                        Sign Up
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-green-600">{success}</p>
                    </div>
                )}

                {/* LOGIN FORM */}
                {mode === 'login' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Phone or Email</label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="9419XXXXXX or email@example.com"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Your password"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40 mt-2">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                onClick={() => { setMode('claim'); setError('') }}
                                className="text-xs text-pink-500 hover:text-pink-700 text-center">
                                Already visited us? Set your password
                            </button>
                            <button
                                onClick={() => { setMode('forgot'); setError('') }}
                                className="text-xs text-gray-400 hover:text-gray-600 text-center">
                                Forgot password?
                            </button>
                        </div>
                    </div>
                )}

                {/* SIGNUP FORM */}
                {mode === 'signup' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Your full name"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Phone number *</label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="9419XXXXXX"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Email (optional)</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="email@example.com"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Password *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Confirm password *</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="Repeat your password"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <button
                            onClick={handleSignup}
                            disabled={loading}
                            className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40 mt-2">
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                        <button
                            onClick={() => { setMode('claim'); setError('') }}
                            className="text-xs text-pink-500 hover:text-pink-700 text-center w-full pt-1">
                            Already visited us? Set your password
                        </button>
                    </div>
                )}

                {/* CLAIM EXISTING ACCOUNT */}
                {mode === 'claim' && (
                    <div className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                            <p className="text-xs text-blue-700 font-medium">
                                Already visited Bliss Makeover? Enter your registered phone number to set a password and access your profile.
                            </p>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Registered phone number *</label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="9419XXXXXX"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Set new password *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Confirm password *</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="Repeat password"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300" />
                        </div>
                        <button
                            onClick={handleClaim}
                            disabled={loading}
                            className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40">
                            {loading ? 'Setting up...' : 'Set Password and Sign In'}
                        </button>
                        <button
                            onClick={() => { setMode('login'); setError('') }}
                            className="text-xs text-gray-400 hover:text-gray-600 text-center w-full">
                            Back to sign in
                        </button>
                    </div>
                )}

                {/* FORGOT PASSWORD */}
                {mode === 'forgot' && (
          <div className="space-y-4">
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">?</div>
              <p className="text-sm font-semibold text-pink-700 mb-2">
                Forgot your password?
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Please WhatsApp us with your registered phone number and we will reset your password for you within a few minutes.
              </p>
              
                href="https://wa.me/917006604551?text=Hi%20Bliss%20Makeover!%20I%20forgot%20my%20portal%20password.%20My%20registered%20phone%20is%3A%20"
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-green-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600">
                WhatsApp Us
              </a>
              <p className="text-xs text-gray-400 mt-3">
                Available: Mon-Sat 9am to 8pm
              </p>
            </div>
            <button
              onClick={() => { setMode('login'); setError('') }}
              className="text-xs text-gray-400 hover:text-gray-600 text-center w-full">
              Back to sign in
            </button>
          </div>
        )}

            <p className="text-center text-xs text-gray-300 mt-6">
                Bliss Makeover By BBI
            </p>
        </div>
    </div >
  )
}