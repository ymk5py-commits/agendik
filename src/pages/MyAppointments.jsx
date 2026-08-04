import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-sand-900 sm:text-3xl">Mis citas</h1>
          <p className="mt-1 text-sm text-sand-500">Todo tu historial y lo que viene.</p>
        </div>
        <Link to="/reservar" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva cita
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar citas"
        className="flex gap-1 overflow-x-auto rounded-xl bg-sand-200/60 p-1"
      >
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`flex min-h-[44px] flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all duration-200 ${
              filter === id ? 'bg-white text-primary-800 shadow-soft' : 'text-sand-600 hover:text-sand-900'
            }`}
          >
            {label}
            {groups[id].length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular ${
                  filter === id ? 'bg-primary-100 text-primary-800' : 'bg-sand-300/60 text-sand-600'
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
