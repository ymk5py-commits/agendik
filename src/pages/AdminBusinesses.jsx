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
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Negocios</h1>
          <p className="mt-1 text-base text-sand-700">
            Los negocios que usan Agendik. Cada uno con su agenda y sus clientes.
          </p>
        </div>
        <button type="button" onClick={() => setModalAbierto(true)} className="btn-primary btn-lg">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Dar de alta un negocio
        </button>
      </div>

      <section aria-labelledby="alta-negocio" className="rounded-2xl bg-primary-50 p-5 sm:p-7">
        <h2 id="alta-negocio" className="font-display text-xl font-bold">De nuevo negocio a primera reserva</h2>
        <ol className="mt-4 grid grid-cols-1 gap-5 text-base md:grid-cols-3">
          <li><span className="font-semibold text-primary-900">1. Creá el negocio</span><p className="mt-1 text-sand-700">Ingresá su nombre, el enlace del portal y el correo del dueño.</p></li>
          <li><span className="font-semibold text-primary-900">2. Entregá el acceso</span><p className="mt-1 text-sand-700">Copiá la contraseña que aparece al finalizar y compartila de forma privada con el dueño.</p></li>
          <li><span className="font-semibold text-primary-900">3. Prepará la agenda</span><p className="mt-1 text-sand-700">El dueño carga servicios, profesionales y horarios. Después comparte su portal con los clientes.</p></li>
        </ol>
      </section>

      {negocios.loading && <Skeleton className="h-24" />}
      {negocios.error && <ErrorState message={negocios.error} onRetry={negocios.reload} />}

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
        <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
          {lista.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sand-900">{n.businessName}</p>
                <p className="truncate text-sm text-sand-700">
                  {n.ownerEmail || 'sin dueño asignado'}
                </p>
              </div>

              <a
                href={`/n/${n.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline text-sm"
                title="Abrir el portal de sus clientes"
              >
                /n/{n.slug}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>

              <span className="hidden text-sm text-sand-700 sm:inline">
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
