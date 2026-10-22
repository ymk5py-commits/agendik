import { Badge } from './ui'
import { formatGs } from '../utils/format'

const STATUS = {
  active: { label: 'Activo', chip: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completado', chip: 'bg-sand-100 text-sand-700' },
  cancelled: { label: 'Cancelado', chip: 'bg-rose-100 text-rose-800' },
}

/** Paquete de sesiones: avance en segmentos (una sesión = un segmento, hasta 12) y el estado de cuenta. */
export default function PackageCard({ pkg }) {
  const meta = STATUS[pkg.status] || STATUS.active
  const totalSessions = pkg.items.reduce((acc, i) => acc + i.quantity, 0)
  const usedSessions = pkg.items.reduce((acc, i) => acc + i.sessionsUsed, 0)
  const segmentos = Math.max(1, Math.min(totalSessions, 12))
  const llenos = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * segmentos) : 0

  return (
    <article className="flex flex-col rounded-2xl border border-sand-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold leading-snug text-primary-950">{pkg.name}</h3>
        <Badge className={meta.chip}>{meta.label}</Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm text-sand-700">
          <span>Sesiones usadas</span>
          <span className="tabular font-display text-lg font-extrabold text-primary-900">
            {usedSessions}
            <span className="text-sand-600"> / {totalSessions}</span>
          </span>
        </div>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSessions}
          aria-valuenow={usedSessions}
          aria-label={`Sesiones usadas del paquete ${pkg.name}`}
        >
          {Array.from({ length: segmentos }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < llenos ? 'bg-primary-700' : 'bg-primary-100'}`} />
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {pkg.items.map((item) => {
          const left = item.quantity - item.sessionsUsed
          return (
            <li key={item.serviceId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-sand-800">{item.service?.name || 'Servicio'}</span>
              <span className={`shrink-0 font-semibold tabular ${left > 0 ? 'text-primary-800' : 'text-sand-600'}`}>
                {left > 0 ? `${left} disponible${left > 1 ? 's' : ''}` : 'Sin sesiones'}
              </span>
            </li>
          )
        })}
      </ul>

      <dl className="mt-4 space-y-1.5 border-t border-sand-200 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-sand-700">Precio</dt>
          <dd className="font-medium tabular text-sand-900">{formatGs(pkg.finalPrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sand-700">Pagado</dt>
          <dd className="font-medium tabular text-emerald-800">{formatGs(pkg.totalPaid)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sand-700">Saldo</dt>
          <dd className={`font-bold tabular ${pkg.remainingBalance > 0 ? 'text-rose-700' : 'text-sand-600'}`}>
            {formatGs(pkg.remainingBalance)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
