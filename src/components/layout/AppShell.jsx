import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import { useAuthStore } from '../../store/authStore'

export default function AppShell() {
    const { profile, signOut } = useAuthStore()

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <div className="hidden md:flex">
                <Sidebar />
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="hidden md:block">
                    <Topbar />
                </div>

                <div className="flex md:hidden bg-white border-b border-gray-100 px-4 py-3 items-center justify-between flex-shrink-0">
                    <div>
                        <div className="text-sm font-semibold text-pink-700">Bliss Makeover</div>
                        <div className="text-xs text-gray-400">Salon Management</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                            {profile?.name?.split(' ')[0]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile?.role === 'admin'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-blue-50 text-blue-600'
                            }`}>
                            {profile?.role}
                        </span>
                        <button
                            onClick={signOut}
                            className="text-xs text-gray-400 hover:text-gray-600">
                            Out
                        </button>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                    <Outlet />
                </main>

                <div className="md:hidden">
                    <BottomNav />
                </div>
            </div>
        </div>
    )
}