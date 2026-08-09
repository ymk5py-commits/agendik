import { useMemo, useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Check, Clock, Phone, User, X } from 'lucide-react'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
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
  const [rango, setRango] = useState('semana')
  const [profesional, setProfesional] = useState('todos')
  const [guardando, setGuardando] = useState(null)

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sand-900 sm:text-3xl">Agenda del negocio</h1>
          <p className="mt-1 text-sm text-sand-600">
            Todas las citas de todos los clientes. Confirmá o cancelá desde acá.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRango(r.id)}
              aria-pressed={rango === r.id}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                rango === r.id
                  ? 'bg-primary-800 text-white'
                  : 'border border-sand-200 bg-white text-sand-700 hover:border-primary-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <Kpi label="Citas en el período" value={resumen.total} />
        <Kpi label="Por confirmar" value={resumen.porConfirmar} tone="accent" />
        <Kpi label="Confirmadas" value={resumen.confirmadas} tone="ok" />
        <Kpi label="A facturar" value={formatGs(resumen.facturable)} small />
      </section>

      {profesionales.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-sand-600">Profesional:</span>
          <button
            type="button"
            onClick={() => setProfesional('todos')}
            aria-pressed={profesional === 'todos'}
            className={`chip cursor-pointer transition-colors ${
              profesional === 'todos' ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-700 hover:bg-sand-200'
            }`}
          >
            Todos
          </button>
          {profesionales.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProfesional(p.id)}
              aria-pressed={profesional === p.id}
              className={`chip cursor-pointer transition-colors ${
                profesional === p.id ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-700 hover:bg-sand-200'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

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
          description="Cambiá el rango de fechas o esperá a que entren reservas nuevas."
        />
      )}

      <div className="space-y-6">
        {porDia.map(([dia, delDia]) => (
          <section key={dia}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sand-500">
              {format(new Date(`${dia}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
              <span className="ml-2 font-normal normal-case tracking-normal text-sand-400">
                {delDia.length} {delDia.length === 1 ? 'cita' : 'citas'}
              </span>
            </h2>

            <ul className="space-y-2.5">
              {delDia.map((cita) => {
                const meta = statusMeta(cita.status)
                const acciones = accionesPara(cita.status)
                return (
                  <li key={cita.id} className="card p-4 sm:p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex min-w-[4.5rem] flex-col">
                        <span className="tabular text-lg font-bold text-sand-900">{cita.startTime}</span>
                        <span className="tabular text-xs text-sand-500">{cita.endTime}</span>
                      </div>

                      <div className="min-w-[12rem] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sand-900">{cita.clientName}</span>
                          <span className={`chip ${meta.chip}`}>{meta.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-sand-600">{cita.servicesLabel}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sand-500">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" aria-hidden="true" />
                            {cita.professionalName}
                          </span>
                          {cita.clientPhone && (
                            <a
                              href={`https://wa.me/${cita.clientPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex cursor-pointer items-center gap-1 hover:text-primary-700 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              {cita.clientPhone}
                            </a>
                          )}
                          {cita.totalPrice > 0 && (
                            <span className="tabular font-medium text-sand-600">{formatGs(cita.totalPrice)}</span>
                          )}
                        </div>
                      </div>

                      {acciones.length > 0 && (
                        <div className="flex gap-2">
                          {acciones.map((a) => (
                            <button
                              key={a.to}
                              type="button"
                              disabled={guardando === cita.id}
                              onClick={() => cambiarEstado(cita, a.to)}
                              className={
                                a.tone === 'ok'
                                  ? 'btn border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 hover:bg-emerald-100'
                                  : 'btn border border-rose-200 bg-white px-3 py-2 text-rose-700 hover:bg-rose-50'
                              }
                            >
                              <a.icon className="h-4 w-4" aria-hidden="true" />
                              <span className="hidden sm:inline">{a.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone, small }) {
  const color =
    tone === 'accent' ? 'text-accent-700' : tone === 'ok' ? 'text-emerald-700' : 'text-sand-900'
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-sand-500">{label}</p>
      <p className={`tabular mt-1 font-bold ${small ? 'text-lg' : 'text-2xl'} ${color}`}>{value}</p>
    </div>
  )
}
