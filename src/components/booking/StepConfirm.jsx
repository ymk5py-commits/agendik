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
          <h3 className="font-display text-lg font-bold text-primary-950">Resumen de tu cita</h3>

          <dl className="mt-3 divide-y divide-sand-200">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-sand-700">Fecha</dt>
              <dd className="text-right text-base font-semibold text-sand-900 first-letter:uppercase">{formatLongDate(date)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-sand-700">Horario</dt>
              <dd className="tabular text-right text-base font-semibold text-sand-900">
                {time} a {endTime} <span className="font-normal text-sand-700">({formatDuration(totalDuration)})</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-sand-700">Profesional</dt>
              <dd className="text-right text-base font-semibold text-sand-900">{professional?.name}</dd>
            </div>
            {usingPackage && (
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-sand-700">Paquete</dt>
                <dd className="text-right text-base font-semibold text-sand-900">{pkg.name}</dd>
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
          <p className="mt-1.5 text-sm tabular text-sand-700">{notes.length}/280</p>
        </section>
      </div>

      {/* Detalle de servicios */}
      <aside className="h-fit rounded-2xl border border-sand-200 bg-white p-5">
        <h3 className="font-display text-lg font-bold text-primary-950">
          {services.length > 1 ? 'Servicios' : 'Servicio'}
        </h3>

        <ul className="mt-3 space-y-2.5">
          {services.map((service) => (
            <li key={service.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-sand-900">{service.name}</p>
                <p className="text-sm text-sand-700">{formatDuration(service.durationMin)}</p>
              </div>
              <span className={`shrink-0 tabular ${usingPackage ? 'text-sand-600 line-through' : 'text-sand-800'}`}>
                {formatGs(service.price)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-sand-200 pt-3">
          {usingPackage ? (
            <div className="rounded-xl bg-accent-50 px-4 py-3">
              <p className="text-sm font-semibold text-accent-900">Cubierto por tu paquete</p>
              <p className="mt-0.5 text-sm text-accent-900">
                Descontamos {services.length} sesión{services.length > 1 ? 'es' : ''} de {pkg.name}.
              </p>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-sand-700">Total</span>
              <span className="font-display text-xl font-extrabold tabular text-sand-900">
                {formatGs(totalPrice)}
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-sand-700">
          Tu cita queda <span className="font-semibold text-sand-900">reservada</span>. El local la confirma
          y te avisa. Podés cancelarla desde “Mis citas”.
        </p>
      </aside>
    </div>
  )
}
