import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { backend } from '../api/backend'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [client, setClient] = useState(null)
  const [staff, setStaff] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    backend
      .restoreSession()
      .then((session) => {
        if (!active || !session) return
        setUser(session.user)
        setClient(session.client)
        setStaff(session.staff || null)
        setTenant(session.tenant)
      })
      .catch(() => {
        // Sesión inválida o backend caído: se arranca sin sesión.
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const session = await backend.signIn(credentials)
    setUser(session.user)
    setClient(session.client)
    setStaff(session.staff || null)
    setTenant(session.tenant)
    return session
  }, [])

  const register = useCallback((payload) => backend.signUp(payload), [])

  const logout = useCallback(async () => {
    await backend.signOut()
    setUser(null)
    setClient(null)
    setStaff(null)
    setTenant(null)
  }, [])

  const updateClient = useCallback((patch) => {
    setClient((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const updateStaff = useCallback((patch) => {
    setStaff((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const value = useMemo(
    () => ({
      user,
      client,
      staff,
      tenant,
      loading,
      // El equipo del negocio entra sin ficha de cliente.
      isAuthenticated: Boolean(user && (client || staff)),
      isStaff: Boolean(staff),
      login,
      register,
      logout,
      updateClient,
      updateStaff,
    }),
    [user, client, staff, tenant, loading, login, register, logout, updateClient, updateStaff],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
