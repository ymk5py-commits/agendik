import { useMemo, useState } from 'react'
import { Pencil, Phone, Plus, Search, UserPlus, Users } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import ClientFormModal from '../components/admin/ClientFormModal'
import { formatShortDate, initials } from '../utils/format'

export default function AdminClients() {
  const { staff } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const clientes = useAsync(() => backend.getAdminClients(), [], { initialData: [] })
  const lista = clientes.data || []

  const abrirNuevo = () => {
    setEditando(null)
    setModalAbierto(true)
  }

  const abrirEdicion = (cliente) => {
    setEditando(cliente)
    setModalAbierto(true)
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((c) =>
      [c.name, c.email, c.phone].filter(Boolean).some((campo) => campo.toLowerCase().includes(q)),
    )
  }, [lista, busqueda])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sand-900 sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-sand-600">
            Quiénes reservan en tu negocio y cuántas citas tiene cada uno.
          </p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-accent">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo cliente
        </button>
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
          icon={busqueda ? Users : UserPlus}
          title={busqueda ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
          description={
            busqueda
              ? 'Probá con otro nombre, email o teléfono.'
              : 'Cargá el primero desde “Nuevo cliente”, o esperá a que alguien se registre en el portal.'
          }
          action={
            busqueda ? undefined : (
              <button type="button" onClick={abrirNuevo} className="btn-primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nuevo cliente
              </button>
            )
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

              {!c.userId && (
                <span className="chip bg-sand-100 text-sand-600" title="Fichado por el negocio, todavía sin cuenta">
                  Sin cuenta
                </span>
              )}

              <button
                type="button"
                onClick={() => abrirEdicion(c)}
                aria-label={`Editar ${c.name}`}
                className="btn-ghost px-2.5"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ClientFormModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSaved={() => clientes.reload()}
        tenantId={staff?.tenantId}
        cliente={editando}
      />
    </div>
  )
}
