import { CalendarDays, Clock, StickyNote, User } from 'lucide-react'
import { Badge } from './ui'
import { formatLongDate } from '../utils/format'
import { isCancellable, statusMeta } from '../utils/appointments'

export default function AppointmentCard({ appointment, onCancel, compact = false }) {
  const meta = statusMeta(appointment.status)
  const title = appointment.services?.map((s) => s.name).join(' + ') || 'Cita'
  const cancelable = onCancel && isCancellable(appointment)

  return (
    <article
      className={`rounded-2xl border border-sand-200 bg-white p-4 transition-shadow duration-200 hover:shadow-soft ${
        compact ? '' : 'sm:p-5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-sand-900">{title}</h3>
            <Badge className={meta.chip}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
              {meta.label}
            </Badge>
          </div>

          <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-sand-600">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Fecha</dt>
              <CalendarDays className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <dd className="first-letter:uppercase">{formatLongDate(appointment.date)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Horario</dt>
              <Clock className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <dd className="tabular">
                {appointment.startTime} – {appointment.endTime}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Profesional</dt>
              <User className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <dd>{appointment.professional?.name || 'Por asignar'}</dd>
            </div>
          </dl>

          {appointment.notes && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-sand-50 px-3 py-2 text-xs text-sand-600">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sand-400" aria-hidden="true" />
              {appointment.notes}
            </p>
          )}
        </div>

        {cancelable && (
          <button
            type="button"
            onClick={() => onCancel(appointment)}
            className="btn-ghost min-h-[44px] shrink-0 px-3 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          >
            Cancelar
          </button>
        )}
      </div>
    </article>
  )
}
