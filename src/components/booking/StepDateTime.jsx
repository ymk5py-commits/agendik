import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarOff, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { backend } from '../../api/backend'
import { useAsync } from '../../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../ui'
import { toDateKey } from '../../utils/format'

const WEEKDAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

export default function StepDateTime({ professionalId, durationMin, capacity = 1, selectedDate, selectedTime, onSelectDate, onSelectTime }) {
  const [month, setMonth] = useState(() => startOfMonth(selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()))

  const days = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const all = eachDayOfInterval({ start, end })
    return { start, end, all, leadingBlanks: start.getDay() }
  }, [month])

  const today = startOfDay(new Date())

  // Solo consultamos disponibilidad de días futuros del mes visible
  const futureKeys = useMemo(
    () => days.all.filter((d) => !isBefore(d, today)).map(toDateKey),
    [days.all, today],
  )

  const monthAvailability = useAsync(
    () => backend.getMonthAvailability({ professionalId, dateKeys: futureKeys, durationMin, capacity }),
    [professionalId, durationMin, capacity, futureKeys.join('|')],
    { enabled: futureKeys.length > 0, initialData: {} },
  )

  const slots = useAsync(
    () => backend.getAvailability({ professionalId, dateKey: selectedDate, durationMin, capacity }),
    [professionalId, selectedDate, durationMin, capacity],
    { enabled: Boolean(selectedDate), initialData: [] },
  )

  // Si el horario elegido dejó de estar libre, lo soltamos
  useEffect(() => {
    if (selectedTime && !slots.loading && slots.data && !slots.data.includes(selectedTime)) {
      onSelectTime(null)
    }
  }, [slots.data, slots.loading, selectedTime, onSelectTime])

  const availability = monthAvailability.data || {}
  const canGoBack = !isSameMonth(month, today) && isBefore(today, month)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      {/* Calendario */}
      <div className="rounded-2xl border border-sand-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            disabled={!canGoBack}
            aria-label="Mes anterior"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-sand-800 transition-colors hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <h3 className="font-display text-lg font-bold capitalize text-primary-950" aria-live="polite">
            {format(month, 'MMMM yyyy', { locale: es })}
          </h3>

          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-sand-800 transition-colors hover:bg-sand-100"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5" role="grid" aria-label="Calendario de disponibilidad">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="pb-1 text-center text-sm font-semibold text-sand-700" role="columnheader">
              {label}
            </div>
          ))}

          {Array.from({ length: days.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} aria-hidden="true" />
          ))}

          {days.all.map((day) => {
            const dateKey = toDateKey(day)
            const past = isBefore(day, today)
            const count = availability[dateKey]
            const checking = monthAvailability.loading && !past
            const free = !past && count > 0
            const selected = selectedDate === dateKey
            const isToday = isSameDay(day, today)

            return (
              <button
                key={dateKey}
                type="button"
                role="gridcell"
                disabled={past || (!checking && !free)}
                onClick={() => onSelectDate(dateKey)}
                aria-selected={selected}
                aria-label={`${format(day, "d 'de' MMMM", { locale: es })}${
                  free ? `, ${count} horarios libres` : ', sin disponibilidad'
                }`}
                className={`relative flex h-12 min-h-[44px] cursor-pointer flex-col items-center justify-center rounded-xl text-base font-semibold tabular transition-colors duration-150 disabled:cursor-not-allowed ${
                  selected
                    ? 'bg-primary-800 text-white'
                    : free
                      ? 'bg-primary-50 text-primary-800 hover:bg-primary-100'
                      : 'text-sand-500'
                } ${isToday && !selected ? 'ring-2 ring-inset ring-accent-500' : ''}`}
              >
                {format(day, 'd')}
                {free && !selected && (
                  <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary-500" />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-sand-200 pt-3 text-sm text-sand-700">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-primary-100 ring-1 ring-inset ring-primary-400" />
            Con lugar
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-sand-200 ring-1 ring-inset ring-sand-400" />
            Sin lugar
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded ring-2 ring-accent-500" />
            Hoy
          </span>
        </div>
      </div>

      {/* Horarios */}
      <div className="rounded-2xl border border-sand-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary-950">
          <Clock className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Horarios
        </h3>

        {!selectedDate ? (
          <p className="mt-4 text-base text-sand-700">Elegí primero un día del calendario.</p>
        ) : slots.loading ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : slots.error ? (
          <div className="mt-4">
            <ErrorState message={slots.error} onRetry={slots.reload} />
          </div>
        ) : (slots.data || []).length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={CalendarOff}
              title="Sin horarios ese día"
              description="Probá con otra fecha del calendario."
            />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-sand-700">
              {slots.data.length} horario{slots.data.length > 1 ? 's' : ''} disponible
              {slots.data.length > 1 ? 's' : ''}
            </p>
            <div
              className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1"
              role="radiogroup"
              aria-label="Horarios disponibles"
            >
              {slots.data.map((time) => {
                const selected = selectedTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelectTime(time)}
                    className={`min-h-[44px] cursor-pointer rounded-xl text-base font-semibold tabular transition-colors duration-150 ${
                      selected
                        ? 'bg-primary-800 text-white'
                        : 'bg-white text-sand-800 ring-1 ring-inset ring-edge hover:bg-primary-50 hover:text-primary-900 hover:ring-primary-500'
                    }`}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
