import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { backend } from '../api/backend'

const TenantContext = createContext(null)

/**
 * El negocio del portal público, resuelto desde la dirección (/n/<slug>).
 *
 * Antes el negocio salía de una variable de entorno, así que la app servía a
 * uno solo. Ahora lo define el link con el que entra cada cliente, que es lo
 * que permite que varios negocios convivan en la misma instalación.
 *
 * Ojo: esto es para las pantallas públicas. Quien ya inició sesión tiene su
 * negocio en su propia ficha (`useAuth().tenant`) y no depende de la URL.
 */
export function TenantProvider({ children }) {
  const { slug } = useParams()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    setLoading(true)
    backend
      .getTenantBySlug(slug)
      .then((t) => activo && setTenant(t))
      .catch(() => activo && setTenant(null))
      .finally(() => activo && setLoading(false))
    return () => {
      activo = false
    }
  }, [slug])

  const value = useMemo(() => ({ tenant, slug, loading }), [tenant, slug, loading])
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

/** Devuelve { tenant, slug, loading }. Fuera de un portal, tenant es null. */
export function useTenant() {
  return useContext(TenantContext) || { tenant: null, slug: null, loading: false }
}
