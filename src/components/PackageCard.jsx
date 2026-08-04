import { CheckCircle2, PackageCheck } from 'lucide-react'
import { Badge } from './ui'
import { formatGs } from '../utils/format'

const STATUS = {
  active: { label: 'Activo', chip: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completado', chip: 'bg-sand-100 text-sand-600' },
  cancelled: { label: 'Cancelado', chip: 'bg-rose-100 text-rose-700' },
}

export default function PackageCard({ pkg }) {
  const meta = STATUS[pkg.status] || STATUS.active
  const totalSessions = pkg.items.reduce((acc, i) => acc + i.quantity, 0)
  const usedSessions = pkg.items.reduce((acc, i) => acc + i.sessionsUsed, 0)
  const progress = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * 100) : 0

  return (
    <article className="flex flex-col rounded-2xl border border-primary-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold text-sand-900">{pkg.name}</h3>
        <Badge className={meta.chip}>
          {pkg.status === 'active' ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {meta.label}
        </Badge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-sand-500">
          <span>Sesiones usadas</span>
          <span className="font-semibold tabular text-sand-700">
            {usedSessions} / {totalSessions}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand-200"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del paquete ${pkg.name}`}
        >
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {pkg.items.map((item) => {
          const left = item.quantity - item.sessionsUsed
          return (
            <li key={item.serviceId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-sand-700">{item.service?.name || 'Servicio'}</span>
              <span
                className={`shrink-0 text-xs font-semibold tabular ${
                  left > 0 ? 'text-primary-700' : 'text-sand-400'
                }`}
              >
                {left > 0 ? `${left} disponible${left > 1 ? 's' : ''}` : 'Sin sesiones'}
              </span>
            </li>
          )
        })}
      </ul>

      <dl className="mt-4 space-y-1 border-t border-sand-200 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-sand-500">Precio</dt>
          <dd className="font-medium tabular text-sand-900">{formatGs(pkg.finalPrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sand-500">Pagado</dt>
          <dd className="font-medium tabular text-emerald-700">{formatGs(pkg.totalPaid)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sand-500">Saldo</dt>
          <dd className={`font-bold tabular ${pkg.remainingBalance > 0 ? 'text-rose-700' : 'text-sand-400'}`}>
            {formatGs(pkg.remainingBalance)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
