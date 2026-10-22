import { useMemo, useState } from 'react'
import { CalendarRange, KeyRound, Layers, Pencil, Phone, Plus, Search, UserPlus, Users } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import ClientFormModal from '../components/admin/ClientFormModal'
import ClientPasswordModal from '../components/admin/ClientPasswordModal'
import SubscriptionsModal from '../components/admin/SubscriptionsModal'
import PackagesModal from '../components/admin/PackagesModal'
import { formatShortDate, initials } from '../utils/format'

export default function AdminClients() {
  const { staff } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [paquetesDe, setPaquetesDe] = useState(null)
  const [claveDe, setClaveDe] = useState(null)
  const [planesDe, setPlanesDe] = useState(null)
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
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Clientes</h1>
          <p className="mt-1 text-base text-sand-700">Quiénes reservan en tu negocio y cuántas citas tiene cada uno.</p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-primary btn-lg">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo cliente
        </button>
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-600"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
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
        <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
          {visibles.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-900"
              >
                {initials(c.name)}
              </span>

              <div className="min-w-[12rem] flex-1">
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-semibold text-sand-900">
                  {c.name}
                  {!c.userId && (
                    <span className="chip bg-sand-100 text-sand-800" title="Fichado por el negocio, todavía sin cuenta">
                      Sin cuenta
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sand-700">
                  <span className="break-all">{c.email}</span>
                  {c.phone && (
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 text-primary-800 underline decoration-primary-300 underline-offset-4 transition-colors hover:decoration-primary-700"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      {c.phone}
                    </a>
                  )}
                  {c.birthDate && <span>Cumple {formatShortDate(c.birthDate)}</span>}
                </p>
              </div>

              <p className="tabular text-sm text-sand-700">
                <span className="font-display text-xl font-extrabold text-sand-900">{c.appointments}</span> {c.appointments === 1 ? 'cita' : 'citas'}
                <span className="mx-2 text-sand-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-display text-xl font-extrabold text-primary-800">{c.upcoming}</span> {c.upcoming === 1 ? 'activa' : 'activas'}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlanesDe(c)}
                  aria-label={`Planes de ${c.name}`}
                  title="Planes mensuales"
                  className="btn-outline"
                >
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  Planes
                </button>
                <button
                  type="button"
                  onClick={() => setPaquetesDe(c)}
                  aria-label={`Paquetes de ${c.name}`}
                  className="btn-outline"
                >
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  Paquetes
                </button>
                {/* Solo tiene sentido en quienes ya entran al portal: al resto
                    no hay contraseña que cambiarles. */}
                {c.userId && (
                  <button
                    type="button"
                    onClick={() => setClaveDe(c)}
                    aria-label={`Cambiar la contraseña de ${c.name}`}
                    title="Cambiar contraseña"
                    className="btn-ghost min-w-[44px] px-3"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => abrirEdicion(c)}
                  aria-label={`Editar ${c.name}`}
                  title="Editar"
                  className="btn-ghost min-w-[44px] px-3"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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

      <ClientPasswordModal cliente={claveDe} onClose={() => setClaveDe(null)} />

      <SubscriptionsModal
        cliente={planesDe}
        tenantId={staff?.tenantId}
        onClose={() => setPlanesDe(null)}
        onChanged={() => clientes.reload()}
      />

      <PackagesModal
        cliente={paquetesDe}
        tenantId={staff?.tenantId}
        onClose={() => setPaquetesDe(null)}
        onChanged={() => clientes.reload()}
      />
    </div>
  )
}
