const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Sin credenciales de Supabase la app corre con el backend demo del navegador. */
export const isDemoMode = !(url && anonKey)

let implPromise = null

function impl() {
  if (!implPromise) {
    implPromise = isDemoMode
      ? import('./demoBackend').then((m) => m.demoBackend)
      : import('./supabaseBackend').then((m) => m.supabaseBackend)
  }
  return implPromise
}

/**
 * Punto único de acceso a datos. Resuelve la implementación al primer uso,
 * así el SDK de Supabase no entra en el bundle inicial de la landing.
 * Toda la interfaz es asíncrona, por lo que las llamadas no cambian.
 */
export const backend = new Proxy(
  {},
  {
    get(_target, method) {
      return (...args) => impl().then((b) => b[method](...args))
    },
  },
)
