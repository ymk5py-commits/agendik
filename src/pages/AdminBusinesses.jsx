import { useState } from 'react'
import { Building2, ExternalLink, Plus } from 'lucide-react'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import BusinessFormModal from '../components/admin/BusinessFormModal'
import { formatShortDate } from '../utils/format'

/**
 * Los negocios de la plataforma. Solo la ve el dueño de la plataforma; quién
 * puede leerla de verdad lo decide `list_businesses()` en Postgres.
 */
export default function AdminBusinesses() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const negocios = useAsync(() => backend.listBusinesses(), [], { initialData: [] })
  const lista = negocios.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Negocios</h1>
          <p className="mt-0.5 text-sm text-sand-500">
            Los negocios que usan Agendik. Cada uno con su agenda y sus clientes.
          </p>
        </div>
        <button type="button" onClick={() => setModalAbierto(true)} className="btn-accent">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo negocio
        </button>
      </div>

      {negocios.loading && <Skeleton className="h-24" />}
      {negocios.error && <ErrorState onRetry={negocios.reload} />}

      {!negocios.loading && !negocios.error && lista.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Todavía no hay negocios"
          description="Creá el primero y pasale al dueño su contraseña para que entre."
          action={
            <button type="button" onClick={() => setModalAbierto(true)} className="btn-primary">
              Crear el primero
            </button>
          }
        />
      )}

      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((n) => (
            <li key={n.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sand-900">{n.businessName}</p>
                <p className="truncate text-sm text-sand-500">
                  {n.ownerEmail || 'sin dueño asignado'}
                </p>
              </div>

              <a
                href={`/n/${n.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline px-3 py-2 text-sm"
                title="Abrir el portal de sus clientes"
              >
                /n/{n.slug}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>

              <span className="hidden text-xs text-sand-400 sm:inline">
                desde {formatShortDate(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <BusinessFormModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onCreated={() => negocios.reload()}
      />
    </div>
  )
}
