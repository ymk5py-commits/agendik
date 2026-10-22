import { useMemo, useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { CalendarClock, Check, Clock, Phone, Plus, User, X } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import NewAppointmentModal from '../components/admin/NewAppointmentModal'
import RescheduleModal from '../components/admin/RescheduleModal'
import { statusMeta } from '../utils/appointments'
import { formatGs, toDateKey } from '../utils/format'

const RANGOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Próximos 30 días' },
]

function rangoAFechas(id) {
  const hoy = new Date()
  if (id === 'hoy') return { from: toDateKey(hoy), to: toDateKey(hoy) }
  if (id === 'semana') {
    return {
      from: toDateKey(startOfWeek(hoy, { weekStartsOn: 1 })),
      to: toDateKey(endOfWeek(hoy, { weekStartsOn: 1 })),
    }
  }
  return { from: toDateKey(hoy), to: toDateKey(addDays(hoy, 30)) }
}

/** Acciones posibles según el estado actual de la cita. */
function accionesPara(estado) {
  if (estado === 'reserved') {
    return [
      { to: 'confirmed', label: 'Confirmar', icon: Check, tone: 'ok' },
      { to: 'cancelled', label: 'Cancelar', icon: X, tone: 'no' },
    ]
  }
  if (estado === 'confirmed') {
    return [
      { to: 'completed', label: 'Marcar hecha', icon: Check, tone: 'ok' },
      { to: 'cancelled', label: 'Cancelar', icon: X, tone: 'no' },
    ]
  }
  return []
}

export default function AdminAgenda() {
  const { staff } = useAuth()
  const [rango, setRango] = useState('semana')
  const [profesional, setProfesional] = useState('todos')
  const [guardando, setGuardando] = useState(null)
  const [nuevaCita, setNuevaCita] = useState(false)
  const [reprogramando, setReprogramando] = useState(null)

  const { from, to } = useMemo(() => rangoAFechas(rango), [rango])
  const agenda = useAsync(() => backend.getAgenda({ from, to }), [from, to], { initialData: [] })
  const citas = agenda.data || []

  const profesionales = useMemo(() => {
    const vistos = new Map()
    for (const c of citas) vistos.set(c.professionalId, c.professionalName)
    return [...vistos].map(([id, name]) => ({ id, name }))
  }, [citas])

  const visibles = useMemo(
    () => (profesional === 'todos' ? citas : citas.filter((c) => c.professionalId === profesional)),
    [citas, profesional],
  )

  const resumen = useMemo(
    () => ({
      total: visibles.length,
      porConfirmar: visibles.filter((c) => c.status === 'reserved').length,
      confirmadas: visibles.filter((c) => c.status === 'confirmed').length,
      facturable: visibles
        .filter((c) => c.status !== 'cancelled')
        .reduce((acc, c) => acc + c.totalPrice, 0),
    }),
    [visibles],
  )

  // Agrupadas por día, en orden. Las claves ya vienen ordenadas del backend.
  const porDia = useMemo(() => {
    const mapa = new Map()
    for (const c of visibles) {
      if (!mapa.has(c.date)) mapa.set(c.date, [])
      mapa.get(c.date).push(c)
    }
    return [...mapa]
  }, [visibles])

  const cambiarEstado = async (cita, nuevo) => {
    setGuardando(cita.id)
    try {
      await backend.setAppointmentStatus(cita.id, nuevo)
      toast.success(`Cita de ${cita.clientName}: ${statusMeta(nuevo).label.toLowerCase()}`)
      agenda.reload()
    } catch (err) {
      toast.error(err.message || 'No pudimos actualizar la cita.')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Agenda</h1>
          <p className="mt-1 text-base text-sand-700">Todas las citas del negocio. Confirmá, mové o cancelá desde acá.</p>
        </div>
        <button type="button" onClick={() => setNuevaCita(true)} className="btn-primary btn-lg">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva cita
        </button>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-sand-300">
        <div role="tablist" aria-label="Período" className="flex gap-7 overflow-x-auto">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={rango === r.id}
              onClick={() => setRango(r.id)}
              className={`-mb-px min-h-[48px] min-w-[44px] shrink-0 cursor-pointer border-b-2 px-0.5 text-base font-semibold transition-colors duration-150 ${
                rango === r.id
                  ? 'border-primary-800 text-primary-950'
                  : 'border-transparent text-sand-700 hover:text-sand-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {profesionales.length > 1 && (
          <div className="flex items-center gap-2 pb-2">
            <label htmlFor="filtro-profesional" className="text-sm font-medium text-sand-700">
              Profesional
            </label>
            <select
              id="filtro-profesional"
              value={profesional}
              onChange={(e) => setProfesional(e.target.value)}
              className="input w-auto min-w-[10rem]"
            >
              <option value="todos">Todos</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <dl
        aria-label="Resumen del período"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-sand-200 ring-1 ring-sand-200 sm:grid-cols-4"
      >
        <Dato label="Citas en el período" value={resumen.total} />
        <Dato label="Por confirmar" value={resumen.porConfirmar} tone="accent" />
        <Dato label="Confirmadas" value={resumen.confirmadas} tone="ok" />
        <Dato label="A facturar" value={formatGs(resumen.facturable)} small />
      </dl>

      {agenda.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {agenda.error && <ErrorState message={agenda.error} onRetry={agenda.reload} />}

      {!agenda.loading && !agenda.error && porDia.length === 0 && (
        <EmptyState
          icon={Clock}
          title="No hay citas en este período"
          description="Cambiá el rango de fechas, o cargá una reserva que te haya entrado por teléfono."
          action={
            <button type="button" onClick={() => setNuevaCita(true)} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva cita
            </button>
          }
        />
      )}

      <div className="space-y-8">
        {porDia.map(([dia, delDia]) => (
          <section key={dia} aria-label={format(new Date(`${dia}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}>
            <h2 className="flex flex-wrap items-baseline gap-x-3 font-display text-xl font-bold">
              <span className="first-letter:uppercase">
                {format(new Date(`${dia}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
              </span>
              <span className="text-base font-normal text-sand-700">
                {delDia.length} {delDia.length === 1 ? 'cita' : 'citas'}
              </span>
            </h2>

            <ul className="mt-3 divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
              {delDia.map((cita) => {
                const meta = statusMeta(cita.status)
                const acciones = accionesPara(cita.status)
                return (
                  <li key={cita.id} className="flex flex-wrap items-start gap-x-5 gap-y-3 p-4 sm:p-5">
                    <div className="w-20 shrink-0">
                      <p className="tabular font-display text-2xl font-extrabold leading-none text-primary-950">
                        {cita.startTime}
                      </p>
                      <p className="tabular mt-1 text-sm text-sand-700">a {cita.endTime}</p>
                    </div>

                    <div className="min-w-[12rem] flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-lg font-semibold text-sand-900">{cita.clientName}</span>
                        <span className={`chip ${meta.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-base text-sand-800">{cita.servicesLabel}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-sand-700">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-4 w-4" aria-hidden="true" />
                          {cita.professionalName}
                        </span>
                        {cita.clientPhone && (
                          <a
                            href={`https://wa.me/${cita.clientPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 text-primary-800 underline decoration-primary-300 underline-offset-4 transition-colors hover:decoration-primary-700"
                          >
                            <Phone className="h-4 w-4" aria-hidden="true" />
                            {cita.clientPhone}
                          </a>
                        )}
                        {cita.totalPrice > 0 && (
                          <span className="tabular font-medium text-sand-900">{formatGs(cita.totalPrice)}</span>
                        )}
                      </div>
                    </div>

                    {acciones.length > 0 && (
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button
                          type="button"
                          disabled={guardando === cita.id}
                          onClick={() => setReprogramando(cita)}
                          aria-label={`Mover la cita de ${cita.clientName}`}
                          className="btn-outline"
                        >
                          <CalendarClock className="h-4 w-4" aria-hidden="true" />
                          Mover
                        </button>
                        {acciones.map((a) => (
                          <button
                            key={a.to}
                            type="button"
                            disabled={guardando === cita.id}
                            onClick={() => cambiarEstado(cita, a.to)}
                            aria-label={`${a.label}: cita de ${cita.clientName}`}
                            className={
                              a.tone === 'ok'
                                ? 'btn border border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'btn border border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
                            }
                          >
                            <a.icon className="h-4 w-4" aria-hidden="true" />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <NewAppointmentModal
        open={nuevaCita}
        onClose={() => setNuevaCita(false)}
        onCreated={() => agenda.reload()}
        tenantId={staff?.tenantId}
      />

      <RescheduleModal
        cita={reprogramando}
        onClose={() => setReprogramando(null)}
        onDone={() => agenda.reload()}
      />
    </div>
  )
}

/** Una celda de la franja de resumen (todas comparten un solo contenedor). */
function Dato({ label, value, tone, small }) {
  const color = tone === 'accent' ? 'text-accent-700' : tone === 'ok' ? 'text-emerald-700' : 'text-primary-950'
  return (
    <div className="bg-white p-4 sm:p-5">
      <dt className="text-sm text-sand-700">{label}</dt>
      <dd className={`tabular mt-1 font-display font-extrabold ${small ? 'text-xl' : 'text-3xl'} ${color}`}>{value}</dd>
    </div>
  )
}
