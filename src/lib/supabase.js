import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
    realtime: {
        params: { eventsPerSecond: 10 },
    },
    global: {
        headers: { 'x-application-name': 'bliss-makeover' },
        fetch: (url, options = {}) => {
            // Add timeout to every fetch so hung requests dont block the app
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
            return fetch(url, { ...options, signal: controller.signal })
                .finally(() => clearTimeout(timeout))
        },
    },
})

//  Keep-alive system
let keepAliveTimer = null
let reconnectTimer = null
let isReconnecting = false
let failCount = 0
const MAX_FAILS = 3
const PING_INTERVAL = 30 * 1000   // ping every 30 seconds
const RECONNECT_DELAY = 3 * 1000   // wait 3s before retry

async function ping() {
    try {
        const { error } = await supabase
            .from('services')
            .select('id')
            .limit(1)
            .single()

        // RLS error is fine - means connection is alive
        if (!error || error.code === 'PGRST116' || error.message?.includes('row')) {
            failCount = 0
            notifyConnected()
            return
        }

        throw new Error(error.message)
    } catch (err) {
        failCount++
        console.warn('Supabase ping failed (' + failCount + '):', err.message)
        if (failCount >= MAX_FAILS) {
            notifyDisconnected()
            scheduleReconnect()
        }
    }
}

async function reconnect() {
    if (isReconnecting) return
    isReconnecting = true

    try {
        // Force a fresh auth session refresh
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            await supabase.auth.refreshSession()
        }

        // Test connection
        const { error } = await supabase.from('services').select('id').limit(1)
        if (!error || error.code === 'PGRST116') {
            failCount = 0
            isReconnecting = false
            notifyConnected()
            startKeepAlive()
            return
        }
        throw new Error(error?.message || 'Still disconnected')
    } catch (err) {
        console.warn('Reconnect failed:', err.message)
        isReconnecting = false
        // Try again in 5 seconds
        scheduleReconnect(5000)
    }
}

function scheduleReconnect(delay = RECONNECT_DELAY) {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(reconnect, delay)
}

function startKeepAlive() {
    clearInterval(keepAliveTimer)
    keepAliveTimer = setInterval(ping, PING_INTERVAL)
}

function notifyConnected() {
    window.dispatchEvent(new CustomEvent('supabase-connected'))
}

function notifyDisconnected() {
    window.dispatchEvent(new CustomEvent('supabase-disconnected'))
}

// Start immediately
startKeepAlive()

//  Reconnect on tab focus
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // User came back to the tab - ping immediately
        clearTimeout(reconnectTimer)
        ping().then(() => {
            if (failCount === 0) startKeepAlive()
            else scheduleReconnect()
        })
    } else {
        // Tab hidden  pause keep-alive to save resources
        clearInterval(keepAliveTimer)
    }
})

//  Reconnect on network restore 
window.addEventListener('online', () => {
    console.log('Network restored - reconnecting...')
    failCount = 0
    reconnect()
})

window.addEventListener('offline', () => {
    console.log('Network lost')
    clearInterval(keepAliveTimer)
    notifyDisconnected()
})

//  Reconnect after user interaction (safety net) 
let lastInteraction = Date.now()
const IDLE_THRESHOLD = 15 * 1000 // 15 seconds

function handleInteraction() {
    const now = Date.now()
    const idleTime = now - lastInteraction
    lastInteraction = now

    // If user was idle for more than 15s, ping immediately
    if (idleTime > IDLE_THRESHOLD) {
        ping().then(() => {
            if (failCount > 0) scheduleReconnect()
        })
    }
}

// Listen for any user interaction
;['click', 'keydown', 'touchstart', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, handleInteraction, { passive: true })
})