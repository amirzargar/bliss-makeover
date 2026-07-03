import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/appointments', label: 'Appointments' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/services', label: 'Services' },
    { to: '/customers', label: 'Customers' },
    { to: '/loyalty', label: 'Loyalty Points' },
    { to: '/offers', label: 'Offers' },
]


const adminItems = [
    { to: '/staff', label: 'Staff & Commission' },
    { to: '/reports', label: 'Reports' },
]

export default function Sidebar() {
    const { profile } = useAuthStore()

    return (
        <div className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
            <div className="px-4 py-5 border-b border-gray-100">
                <div className="text-base font-semibold text-pink-700">Bliss Makeover</div>
                <div className="text-xs text-gray-400 mt-0.5">Salon Management</div>
            </div>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {navItems.map(({ to, label }) => (
                    <NavLink key={to} to={to} end={to === '/'}
                        className={({ isActive }) =>
                            `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                ? 'bg-pink-50 text-pink-700 font-medium'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                            }`
                        }>
                        {label}
                    </NavLink>
                ))}
                {profile?.role === 'admin' && (
                    <>
                        <div className="text-xs text-gray-300 uppercase tracking-wider px-3 pt-4 pb-1">Admin</div>
                        {adminItems.map(({ to, label }) => (
                            <NavLink key={to} to={to}
                                className={({ isActive }) =>
                                    `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                        ? 'bg-pink-50 text-pink-700 font-medium'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                                    }`
                                }>
                                {label}
                            </NavLink>
                        ))}
                    </>
                )}
            </nav>
        </div>
    )
}