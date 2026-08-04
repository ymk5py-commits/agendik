import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true cuando el proyecto tiene backend real configurado */
export const hasSupabase = Boolean(url && anonKey)

export const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT || 'estudio-alma'

export const supabase = hasSupabase
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null
