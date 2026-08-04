import { CalendarDays, Clock, Layers, User } from 'lucide-react'
import { addMinutesToTime, formatDuration, formatGs, formatLongDate } from '../../utils/format'

export default function StepConfirm({ services, professional, date, time, pkg, notes, onNotesChange }) {
  const totalDuration = services.reduce((acc, s) => acc + s.durationMin, 0)
  const totalPrice = services.reduce((acc, s) => acc + s.price, 0)
  const endTime = addMinutesToTime(time, totalDuration)
  const usingPackage = Boolean(pkg)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-sand-200 bg-white p-5">
          <h3 className="font-display text-base font-bold text-sand-900">Resumen de tu cita</h3>

          <dl className="mt-4 space-y-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs text-sand-500">Fecha</dt>
                <dd className="text-sm font-semibold text-sand-900 first-letter:uppercase">{formatLongDate(date)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs text-sand-500">Horario</dt>
                <dd className="text-sm font-semibold tabular text-sand-900">
                  {time} – {endTime}{' '}
                  <span className="font-normal text-sand-500">({formatDuration(totalDuration)})</span>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs text-sand-500">Profesional</dt>
                <dd className="text-sm font-semibold text-sand-900">{professional?.name}</dd>
              </div>
            </div>

            {usingPackage && (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <dt className="text-xs text-sand-500">Paquete</dt>
                  <dd className="text-sm font-semibold text-sand-900">{pkg.name}</dd>
                </div>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-5">
          <label htmlFor="notas" className="label">
            Nota para el profesional
          </label>
          <textarea
            id="notas"
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={280}
            placeholder="Algo que quieras aclarar antes de la cita (opcional)"
            className="input resize-none"
          />
          <p className="mt-1.5 text-xs tabular text-sand-500">{notes.length}/280</p>
        </section>
      </div>

      {/* Detalle de servicios */}
      <aside className="h-fit rounded-2xl border border-sand-200 bg-white p-5">
        <h3 className="font-display text-base font-bold text-sand-900">
          {services.length > 1 ? 'Servicios' : 'Servicio'}
        </h3>

        <ul className="mt-3 space-y-2.5">
          {services.map((service) => (
            <li key={service.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-sand-900">{service.name}</p>
                <p className="text-xs text-sand-500">{formatDuration(service.durationMin)}</p>
              </div>
              <span className={`shrink-0 tabular ${usingPackage ? 'text-sand-400 line-through' : 'text-sand-700'}`}>
                {formatGs(service.price)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-sand-200 pt-3">
          {usingPackage ? (
            <div className="rounded-xl bg-accent-50 px-3.5 py-3">
              <p className="text-xs font-semibold text-accent-900">Cubierto por tu paquete</p>
              <p className="mt-0.5 text-xs text-accent-800">
                Descontamos {services.length} sesión{services.length > 1 ? 'es' : ''} de {pkg.name}.
              </p>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-sand-500">Total</span>
              <span className="font-display text-xl font-extrabold tabular text-sand-900">
                {formatGs(totalPrice)}
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-sand-500">
          Tu cita queda <span className="font-semibold text-sand-700">reservada</span>. El local la confirma
          y te avisa. Podés cancelarla desde “Mis citas”.
        </p>
      </aside>
    </div>
  )
}
