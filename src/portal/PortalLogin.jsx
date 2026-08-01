import { useState } from 'react'
import { supabase } from '../lib/supabase'

function generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

function hashPassword(password) {
    let hash = 0
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

export default function PortalLogin({ onLogin }) {
    const [mode, setMode] = useState('login')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

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
            setError('Invalid phone or email or password. Please try again.')
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

        const { data: existing } = await supabase
            .from('customers').select('id, portal_password').eq('phone', phone.trim()).single()

        if (existing) {
            if (existing.portal_password) {
                setError('An account with this phone already exists. Please sign in.')
            } else {
                setError('You are already registered at our salon. Use "Already visited us?" to set your password.')
            }
            setLoading(false)
            return
        }

        const hashed = hashPassword(password)
        const { data: newCustomer, error: err } = await supabase
            .from('customers').insert({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase() || null,
                portal_password: hashed,
                portal_active: true,
                source: 'portal',
                portal_joined: new Date().toISOString(),
            }).select().single()

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
            .from('customers').select('*').eq('phone', phone.trim()).single()

        if (!existing) {
            setError('No account found with this phone number. Please sign up instead.')
            setLoading(false)
            return
        }

        if (existing.portal_password) {
            setError('This account already has a password. Please sign in.')
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
        <div className="min-h-screen bg-pink-50 flex flex-col">

            {/* Hero header */}
            <div className="bg-white border-b border-pink-100 px-6 py-8 text-center">
                <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 border-2 border-pink-100 shadow-sm">
                    <img
                        src="/icons/icon-192x192.png"
                        alt="Bliss Makeover"
                        className="w-full h-full object-cover" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">Bliss Makeover</h1>
                <p className="text-sm text-pink-400 tracking-widest uppercase mb-1">
                    Where Elegance Meets Expertise
                </p>
                <p className="text-xs text-gray-400">Nagbal Chowk, Bhat Complex, Jammu</p>
            </div>

            {/* Main card */}
            <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-pink-100 w-full max-w-sm p-6">

                    {/* Mode tabs */}
                    {(mode === 'login' || mode === 'signup') && (
                        <div className="flex bg-pink-50 rounded-xl p-1 mb-5">
                            <button
                                onClick={() => { setMode('login'); setError('') }}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode === 'login'
                                        ? 'bg-white text-pink-700 shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}>
                                Sign In
                            </button>
                            <button
                                onClick={() => { setMode('signup'); setError('') }}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode === 'signup'
                                        ? 'bg-white text-pink-700 shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}>
                                Sign Up
                            </button>
                        </div>
                    )}

                    {/* Back button for claim/forgot */}
                    {(mode === 'claim' || mode === 'forgot') && (
                        <button
                            onClick={() => { setMode('login'); setError('') }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
                            &lt; Back to sign in
                        </button>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-xs text-red-600">{error}</p>
                        </div>
                    )}

                    {/* LOGIN */}
                    {mode === 'login' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Phone or email</label>
                                <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="9419XXXXXX or email@example.com"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Your password"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <button
                                onClick={handleLogin}
                                disabled={loading}
                                className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-40 mt-1">
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                            <div className="flex flex-col gap-2 pt-1">
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

                    {/* SIGNUP */}
                    {mode === 'signup' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Your full name"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Phone number *</label>
                                <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="9419XXXXXX"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Email (optional)</label>
                                <input
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Password *</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Confirm password *</label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repeat your password"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <button
                                onClick={handleSignup}
                                disabled={loading}
                                className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-40 mt-1">
                                {loading ? 'Creating account...' : 'Create Account'}
                            </button>
                            <button
                                onClick={() => { setMode('claim'); setError('') }}
                                className="text-xs text-pink-500 hover:text-pink-700 text-center w-full pt-1">
                                Already visited us? Set your password
                            </button>
                        </div>
                    )}

                    {/* CLAIM */}
                    {mode === 'claim' && (
                        <div className="space-y-3">
                            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-1">
                                <p className="text-xs text-pink-700">
                                    Already visited Bliss Makeover? Enter your registered phone number to set a password and access your full profile and history.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Registered phone number *</label>
                                <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="9419XXXXXX"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Set new password *</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Confirm password *</label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repeat password"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-300 bg-gray-50" />
                            </div>
                            <button
                                onClick={handleClaim}
                                disabled={loading}
                                className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-40">
                                {loading ? 'Setting up...' : 'Set Password and Sign In'}
                            </button>
                        </div>
                    )}

                    {/* FORGOT */}
                    {mode === 'forgot' && (
                        <div className="space-y-4">
                            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-5 text-center">
                                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-pink-600 text-xl">?</span>
                                </div>
                                <p className="text-sm font-medium text-gray-800 mb-2">Forgot your password?</p>
                                <p className="text-xs text-gray-500 mb-4">
                                    WhatsApp us with your registered phone number and we will reset your password within a few minutes.
                                </p>
                                <button
                                    onClick={() => {
                                        const msg = 'Hi Bliss Makeover! I forgot my portal password. My registered phone is: '
                                        window.open('https://wa.me/917006604551?text=' + encodeURIComponent(msg), '_blank')
                                    }}
                                    className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-600">
                                    WhatsApp Us
                                </button>
                                <p className="text-xs text-gray-400 mt-3">Available Mon-Sat, 9am to 8pm</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Blusha by Insha teaser */}
            <div className="px-4 pb-6">
                <div className="bg-white border border-pink-100 rounded-2xl p-4 max-w-sm mx-auto text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Also by Insha Feroz</p>
                    <p className="text-base font-semibold text-gray-800 mb-1">Blusha by Insha</p>
                    <p className="text-xs text-gray-500 mb-3">
                        Professional bridal and editorial makeup artistry. Pre-weddings, photoshoots and special occasions.
                    </p>
                    <button
                        onClick={() => window.open('https://blissmakeover.framer.website', '_blank')}
                        className="text-xs text-pink-600 border border-pink-200 px-4 py-2 rounded-lg hover:bg-pink-50 transition-colors">
                        Visit Blusha by Insha
                    </button>
                </div>
            </div>

            <p className="text-center text-xs text-gray-300 pb-4">
                Bliss Makeover - Nagbal Chowk, Jammu
            </p>
        </div>
    )
}