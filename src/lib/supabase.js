import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
    db: {
        schema: 'public',
    },
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
    global: {
        headers: { 'x-application-name': 'bliss-makeover' },
    },
})

// Keep connection alive - ping every 4 minutes
setInterval(async () => {
    try {
        await supabase.from('services').select('id').limit(1)
    } catch {
        // silent - just keeping connection alive
    }
}, 4 * 60 * 1000)

// Auto reconnect on visibility change - when user comes back to the tab
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        try {
            await supabase.from('services').select('id').limit(1)
        } catch {
            // silent
        }
    }
})

// Auto reconnect on network coming back online
window.addEventListener('online', async () => {
    try {
        await supabase.from('services').select('id').limit(1)
        console.log('Reconnected to database')
    } catch {
        console.log('Reconnection failed - will retry')
    }
})