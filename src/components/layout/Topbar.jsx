import { useAuthStore } from '../../store/authStore'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
    '/': 'Dashboard',
    '/appointments': 'Appointments',
    '/inventory': 'Inventory',
    '/services': 'Services',
    '/customers': 'Customers',
    '/loyalty': 'Loyalty Points',
    '/offers': 'Offers & Discounts',
    '/staff': 'Staff & Commission',
    '/reports': 'Reports',
    '/product-sales': 'Product Sales',
}

export default function Topbar() {
    const { profile, signOut } = useAuthStore()
    const location = useLocation()
    const title = PAGE_TITLES[location.pathname] || 'Bliss Makeover'

    return (
        <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
            <span className="text-sm font-medium text-gray-700">{title}</span>
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{profile?.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${profile?.role === 'admin'
                        ? 'bg-pink-100 text-pink-700'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                    {profile?.role}
                </span>
                <button onClick={signOut}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Sign out
                </button>
            </div>
        </div>
    )
}