import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
    user: null,
    profile: null,   // row from your users table (name, role, etc.)
    loading: true,

    init: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', session.user.id)
                .single()
            set({ user: session.user, profile, loading: false })
        } else {
            set({ loading: false })
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', session.user.id)
                    .single()
                set({ user: session.user, profile })
            } else {
                set({ user: null, profile: null })
            }
        })
    },

    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        return { data, error }
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null })
    },
}))