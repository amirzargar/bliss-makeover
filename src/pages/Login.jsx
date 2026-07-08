import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleLogin(e) {
        e.preventDefault()
        if (!email.trim() || !password) return alert('Please fill in all fields')

        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        })

        if (error) {
            alert(`Authentication failed: ${error.message}`)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Bliss Makeover</h1>
                    <p className="text-sm text-gray-400 mt-1">Sign in to manage your salon</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@bliss.com"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 mt-2"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    )
}