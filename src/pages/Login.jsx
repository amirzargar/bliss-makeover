import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const signIn = useAuthStore(s => s.signIn)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        const { error } = await signIn(email, password)
        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            navigate('/')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-pink-50">
            <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-8 w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="text-3xl font-semibold text-pink-700 mb-1">Bliss Makeover</div>
                    <div className="text-sm text-gray-400">Salon Management</div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                            placeholder="you@example.com" required />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
                            placeholder="••••••••" required />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={loading}
                        className="w-full bg-pink-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    )
}