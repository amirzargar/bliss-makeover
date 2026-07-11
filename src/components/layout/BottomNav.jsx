import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function BottomNav() {
    const { profile } = useAuthStore()

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 md:hidden">
            <div className="flex items-center justify-around px-2 py-1">

                <NavLink to="/" end
                    className={({ isActive }) =>
                        `flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] ${isActive ? 'text-pink-600' : 'text-gray-400'
                        }`
                    }>
                    {({ isActive }) => (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-xs font-medium">Home</span>
                        </>
                    )}
                </NavLink>

                <NavLink to="/appointments"
                    className={({ isActive }) =>
                        `flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] ${isActive ? 'text-pink-600' : 'text-gray-400'
                        }`
                    }>
                    {({ isActive }) => (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium">Bookings</span>
                        </>
                    )}
                </NavLink>

                <NavLink to="/customers"
                    className={({ isActive }) =>
                        `flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] ${isActive ? 'text-pink-600' : 'text-gray-400'
                        }`
                    }>
                    {({ isActive }) => (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs font-medium">Customers</span>
                        </>
                    )}
                </NavLink>

                <NavLink to="/inventory"
                    className={({ isActive }) =>
                        `flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] ${isActive ? 'text-pink-600' : 'text-gray-400'
                        }`
                    }>
                    {({ isActive }) => (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-xs font-medium">Stock</span>
                        </>
                    )}
                </NavLink>

                <NavLink to="/more"
                    className={({ isActive }) =>
                        `flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] ${isActive ? 'text-pink-600' : 'text-gray-400'
                        }`
                    }>
                    {({ isActive }) => (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span className="text-xs font-medium">More</span>
                        </>
                    )}
                </NavLink>

            </div>
        </nav>
    )
}