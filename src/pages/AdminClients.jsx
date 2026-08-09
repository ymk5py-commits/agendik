import { useMemo, useState } from 'react'
import { Phone, Search, Users } from 'lucide-react'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { formatShortDate, initials } from '../utils/format'

export default function AdminClients() {
  const [busqueda, setBusqueda] = useState('')
  const clientes = useAsync(() => backend.getAdminClients(), [], { initialData: [] })
  const lista = clientes.data || []

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((c) =>
      [c.name, c.email, c.phone].filter(Boolean).some((campo) => campo.toLowerCase().includes(q)),
    )
  }, [lista, busqueda])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-sand-900 sm:text-3xl">Clientes</h1>
        <p className="mt-1 text-sm text-sand-600">
          Quiénes reservan en tu negocio y cuántas citas tiene cada uno.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          aria-label="Buscar cliente"
          className="input pl-10"
        />
      </div>

      {clientes.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {clientes.error && <ErrorState message={clientes.error} onRetry={clientes.reload} />}

      {!clientes.loading && !clientes.error && visibles.length === 0 && (
        <EmptyState
          icon={Users}
          title={busqueda ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
          description={
            busqueda
              ? 'Probá con otro nombre, email o teléfono.'
              : 'Cuando alguien cree su cuenta en el portal, va a aparecer acá.'
          }
        />
      )}

      {visibles.length > 0 && (
        <ul className="space-y-2.5">
          {visibles.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center gap-4 p-4 sm:p-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800"
              >
                {initials(c.name)}
              </span>

              <div className="min-w-[10rem] flex-1">
                <p className="font-semibold text-sand-900">{c.name}</p>
                <p className="text-sm text-sand-500">{c.email}</p>
              </div>

              {c.phone && (
                <a
                  href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-sand-600 hover:text-primary-700 hover:underline"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {c.phone}
                </a>
              )}

              <div className="flex items-center gap-5 text-center">
                <div>
                  <p className="tabular text-lg font-bold text-sand-900">{c.appointments}</p>
                  <p className="text-xs text-sand-500">citas</p>
                </div>
                <div>
                  <p className="tabular text-lg font-bold text-primary-700">{c.upcoming}</p>
                  <p className="text-xs text-sand-500">activas</p>
                </div>
              </div>

              {c.birthDate && (
                <span className="text-xs text-sand-400">Cumple {formatShortDate(c.birthDate)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
