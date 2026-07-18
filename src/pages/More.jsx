import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const items = [
    { to: '/product-sales', label: 'Product Sales', desc: 'Sell products without appointment' },
    { to: '/services', label: 'Services & Pricing', desc: 'Manage your service menu' },
    { to: '/loyalty', label: 'Loyalty Points', desc: 'Customer points and tiers' },
    { to: '/offers', label: 'Offers & Discounts', desc: 'Create and manage offers' },
    { to: '/staff', label: 'Staff & Commission', desc: 'Team and payouts', adminOnly: true },
    { to: '/reports', label: 'Reports', desc: 'Business analytics', adminOnly: true },
]

export default function More() {
    const { profile, signOut } = useAuthStore()

    return (
        <div>
            <h1 className="text-xl font-semibold text-gray-800 mb-1">More</h1>
            <p className="text-sm text-gray-400 mb-5">All modules</p>

            <div className="space-y-2">
                {items.map(item => {
                    if (item.adminOnly && profile?.role !== 'admin') return null
                    return (
                        <Link key={item.to} to={item.to}
                            className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4 hover:border-pink-200 transition-colors">
                            <div>
                                <div className="font-medium text-gray-800 text-sm">{item.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    )
                })}
            </div>

            <div className="mt-6 bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-lg">
                        {profile?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-gray-800 text-sm">{profile?.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile?.role === 'admin' ? 'bg-pink-100 text-pink-700' : 'bg-blue-50 text-blue-600'
                            }`}>
                            {profile?.role}
                        </span>
                    </div>
                </div>
                <button onClick={signOut}
                    className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                    Sign Out
                </button>
            </div>
        </div>
    )
}