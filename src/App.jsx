import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Inventory from './pages/Inventory'
import Services from './pages/Services'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import Loyalty from './pages/Loyalty'
import Offers from './pages/Offers'
import AppShell from './components/layout/AppShell'
import Reports from './pages/Reports'
import More from './pages/More'

function ProtectedRoute({ children, adminOnly = false }) {
    const { user, profile, loading } = useAuthStore()
    if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
    if (!user) return <Navigate to="/login" replace />
    if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />
    return children
}

export default function App() {
    const init = useAuthStore(s => s.init)
    useEffect(() => { init() }, [])

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                    <ProtectedRoute><AppShell /></ProtectedRoute>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="appointments" element={<Appointments />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="services" element={<Services />} />
                    <Route path="staff" element={<ProtectedRoute adminOnly><Staff /></ProtectedRoute>} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="loyalty" element={<Loyalty />} />
                    <Route path="offers" element={<Offers />} />
                    <Route path="reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
                    <Route path="more" element={<More />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}