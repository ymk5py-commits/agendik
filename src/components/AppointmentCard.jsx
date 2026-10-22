import { Clock, StickyNote, User } from 'lucide-react'
import { Badge } from './ui'
import { formatDayParts, formatLongDate } from '../utils/format'
import { isCancellable, isUpcoming, statusMeta } from '../utils/appointments'

/**
 * Una cita. A la izquierda la «ficha de fecha» (para escanear una lista de citas de un vistazo): petróleo si la
 * cita sigue vigente, arena si ya pasó o se canceló. La fecha completa va también como texto para lectores de pantalla.
 */
export default function AppointmentCard({ appointment, onCancel }) {
  const meta = statusMeta(appointment.status)
  const title = appointment.services?.map((s) => s.name).join(' + ') || 'Cita'
  const cancelable = onCancel && isCancellable(appointment)
  const vigente = isUpcoming(appointment) && ['reserved', 'confirmed'].includes(appointment.status)
  const { weekday, day, month } = formatDayParts(appointment.date)

  return (
    <article className="flex gap-4 rounded-2xl border border-sand-200 bg-white p-4 sm:gap-5 sm:p-5">
      <div
        aria-hidden="true"
        className={`flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl py-3 ${
          vigente ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-700'
        }`}
      >
        <span className="text-[0.8125rem] font-medium capitalize leading-tight">{weekday}</span>
        <span className="tabular font-display text-3xl font-extrabold leading-none">{day}</span>
        <span className="text-[0.8125rem] font-medium capitalize leading-tight">{month}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="font-display text-lg font-bold leading-snug text-primary-950">{title}</h3>
          <Badge className={meta.chip}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            {meta.label}
          </Badge>
        </div>

        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-base text-sand-700">
          <div className="sr-only">
            <dt>Fecha</dt>
            <dd>{formatLongDate(appointment.date)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Horario</dt>
            <Clock className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <dd className="tabular">
              {appointment.startTime} a {appointment.endTime}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Profesional</dt>
            <User className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <dd>{appointment.professional?.name || 'Por asignar'}</dd>
          </div>
        </dl>

        {appointment.notes && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-sand-100 px-3.5 py-2.5 text-sm text-sand-700">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-sand-600" aria-hidden="true" />
            {appointment.notes}
          </p>
        )}

        {cancelable && (
          <button
            type="button"
            onClick={() => onCancel(appointment)}
            className="btn-ghost -ml-3 mt-2 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          >
            Cancelar cita
          </button>
        )}
      </div>
    </article>
  )
}
