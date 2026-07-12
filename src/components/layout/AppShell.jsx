import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import { useAuthStore } from '../../store/authStore'

function InstallPrompt() {
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
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-2xl border border-pink-200 shadow-lg p-4 z-50">
            <div className="flex items-start gap-3">
                <img
                    src="/icons/icon-192x192.png"
                    alt="Bliss Makeover"
                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">Install Bliss Makeover</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        Add to your home screen for quick access
                    </div>
                </div>
                <button onClick={() => setShow(false)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 text-lg font-bold">
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

                <InstallPrompt />
            </div>
        </div>
    )
}