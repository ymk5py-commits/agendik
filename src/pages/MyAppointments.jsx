import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Plus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import AppointmentCard from '../components/AppointmentCard'
import CancelAppointmentModal from '../components/CancelAppointmentModal'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { byDateTimeAsc, byDateTimeDesc, isUpcoming } from '../utils/appointments'

const FILTERS = [
  { id: 'upcoming', label: 'Próximas' },
  { id: 'past', label: 'Pasadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

export default function MyAppointments() {
  const { client } = useAuth()
  const [filter, setFilter] = useState('upcoming')
  const [toCancel, setToCancel] = useState(null)
  // Viene de reservar: se muestra un mensaje fijo (no un aviso que desaparece) con lo que pasa ahora.
  const location = useLocation()
  const [avisoReserva, setAvisoReserva] = useState(Boolean(location.state?.reservada))

  const appointments = useAsync(() => backend.getAppointments(client.id), [client.id], { initialData: [] })
  const list = appointments.data || []

  const groups = useMemo(
    () => ({
      upcoming: list
        .filter((a) => isUpcoming(a) && ['reserved', 'confirmed'].includes(a.status))
        .sort(byDateTimeAsc),
      past: list
        .filter((a) => a.status === 'completed' || (!isUpcoming(a) && a.status !== 'cancelled'))
        .sort(byDateTimeDesc),
      cancelled: list.filter((a) => a.status === 'cancelled').sort(byDateTimeDesc),
    }),
    [list],
  )

  const visible = groups[filter]

  const handleCancelled = (updated) => {
    appointments.setData((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Mis citas</h1>
          <p className="mt-1 text-base text-sand-700">Todo tu historial y lo que viene.</p>
        </div>
        <Link to="/reservar" className="btn-primary btn-lg">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva cita
        </Link>
      </div>

      {avisoReserva && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-base">
            <span className="font-semibold">Tu cita quedó reservada.</span> El negocio la confirma y te avisa por mail.
            Podés cancelarla desde acá.
          </p>
          <button
            type="button"
            onClick={() => setAvisoReserva(false)}
            aria-label="Cerrar mensaje"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-emerald-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Filtrar citas" className="flex gap-7 overflow-x-auto border-b border-sand-300">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`-mb-px flex min-h-[48px] min-w-[44px] shrink-0 cursor-pointer items-center gap-2 border-b-2 px-0.5 text-base font-semibold transition-colors duration-150 ${
              filter === id
                ? 'border-primary-800 text-primary-950'
                : 'border-transparent text-sand-700 hover:text-sand-900'
            }`}
          >
            {label}
            {groups[id].length > 0 && (
              <span
                className={`tabular rounded-full px-2 py-0.5 text-[0.8125rem] ${
                  filter === id ? 'bg-primary-100 text-primary-900' : 'bg-sand-200 text-sand-800'
                }`}
              >
                {groups[id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {appointments.loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)
        ) : appointments.error ? (
          <ErrorState message={appointments.error} onRetry={appointments.reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={EMPTY_COPY[filter].title}
            description={EMPTY_COPY[filter].description}
            action={
              filter === 'upcoming' ? (
                <Link to="/reservar" className="btn-primary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Reservar una cita
                </Link>
              ) : null
            }
          />
        ) : (
          visible.map((appt) => (
            <AppointmentCard key={appt.id} appointment={appt} onCancel={setToCancel} />
          ))
        )}
      </div>

      {toCancel && (
        <CancelAppointmentModal
          appointment={toCancel}
          onClose={() => setToCancel(null)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}

const EMPTY_COPY = {
  upcoming: {
    title: 'No tenés citas agendadas',
    description: 'Reservá la próxima sin llamar ni esperar respuesta.',
  },
  past: {
    title: 'Todavía no hay citas pasadas',
    description: 'Acá va a quedar el historial de todo lo que te hiciste.',
  },
  cancelled: {
    title: 'No cancelaste ninguna cita',
    description: 'Si cancelás alguna, la vas a ver listada acá.',
  },
}
