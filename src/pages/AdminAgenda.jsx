import { useMemo, useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Clock, MousePointerClick, Phone, Plus, User, X } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import NewAppointmentModal from '../components/admin/NewAppointmentModal'
import RescheduleModal from '../components/admin/RescheduleModal'
import AgendaDia from '../components/admin/AgendaDia'
import { statusMeta } from '../utils/appointments'
import { formatGs, toDateKey } from '../utils/format'

const RANGOS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Próximos 30 días' },
]

function rangoAFechas(id, fecha) {
  const hoy = new Date()
  if (id === 'dia') return { from: toDateKey(fecha), to: toDateKey(fecha) }
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
  // Como en Fresha o Square, la agenda abre en el día de hoy con una columna por profesional.
  const [rango, setRango] = useState('dia')
  const [fecha, setFecha] = useState(() => new Date())
  const [seleccionada, setSeleccionada] = useState(null)
  const [profesional, setProfesional] = useState('todos')
  const [guardando, setGuardando] = useState(null)
  const [nuevaCita, setNuevaCita] = useState(false)
  const [reprogramando, setReprogramando] = useState(null)

  const { from, to } = useMemo(() => rangoAFechas(rango, fecha), [rango, fecha])
  const agenda = useAsync(() => backend.getAgenda({ from, to }), [from, to], { initialData: [] })
  const citas = agenda.data || []
  const equipo = useAsync(() => backend.getProfessionals(), [], { initialData: [] })

  // Para el filtro: todo el equipo activo, más quien tenga citas en el período aunque ya no esté activo.
  const profesionales = useMemo(() => {
    const vistos = new Map((equipo.data || []).map((p) => [p.id, p.name]))
    for (const c of citas) if (!vistos.has(c.professionalId)) vistos.set(c.professionalId, c.professionalName)
    return [...vistos].map(([id, name]) => ({ id, name }))
  }, [equipo.data, citas])

  const cambiarDia = (dias) => {
    setFecha((f) => addDays(f, dias))
    setSeleccionada(null)
  }
  const esHoy = toDateKey(fecha) === toDateKey(new Date())
  const citaElegida = citas.find((c) => c.id === seleccionada) || null

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
              onClick={() => {
                setRango(r.id)
                setSeleccionada(null)
              }}
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

      {rango === 'dia' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <button type="button" onClick={() => cambiarDia(-1)} className="btn-outline px-3" aria-label="Día anterior">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => cambiarDia(1)} className="btn-outline px-3" aria-label="Día siguiente">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <h2 className="font-display text-xl font-bold first-letter:uppercase" aria-live="polite">
            {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          {!esHoy && (
            <button
              type="button"
              onClick={() => {
                setFecha(new Date())
                setSeleccionada(null)
              }}
              className="btn-ghost"
            >
              Volver a hoy
            </button>
          )}
        </div>
      )}

      <dl
        aria-label="Resumen del período"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-sand-200 ring-1 ring-sand-200 sm:grid-cols-4"
      >
        <Dato label="Citas en el período" value={resumen.total} />
        <Dato label="Por confirmar" value={resumen.porConfirmar} tone="accent" />
        <Dato label="Confirmadas" value={resumen.confirmadas} tone="ok" />
        <Dato label="A facturar" value={formatGs(resumen.facturable)} small />
      </dl>

      {agenda.error && <ErrorState message={agenda.error} onRetry={agenda.reload} />}

      {/* Vista Día en escritorio: grilla por profesional + detalle de la cita elegida (sin ventana modal) */}
      {rango === 'dia' && !agenda.error && (
        <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={agenda.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={agenda.loading}>
            <AgendaDia
              fecha={fecha}
              citas={visibles}
              profesionales={profesional === 'todos' ? profesionales : profesionales.filter((p) => p.id === profesional)}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
            />
          </div>
          <aside aria-label="Detalle de la cita" className="self-start lg:sticky lg:top-24">
            {citaElegida ? (
              <DetalleCita
                cita={citaElegida}
                ocupado={guardando === citaElegida.id}
                onMover={() => setReprogramando(citaElegida)}
                onCambiar={(estado) => cambiarEstado(citaElegida, estado)}
                onCerrar={() => setSeleccionada(null)}
              />
            ) : (
              <p className="flex gap-3 rounded-2xl border border-dashed border-sand-300 p-5 text-sm leading-relaxed text-sand-700">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                Tocá una cita para ver el detalle y confirmarla, moverla o cancelarla.
              </p>
            )}
          </aside>
        </div>
      )}

      <div className={`space-y-8 ${rango === 'dia' ? 'lg:hidden' : ''}`}>
      {agenda.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

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
            <h2 className={`flex flex-wrap items-baseline gap-x-3 font-display text-xl font-bold ${rango === 'dia' ? 'sr-only' : ''}`}>
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

/** Detalle de la cita elegida en la grilla del día, con las mismas acciones que la lista. */
function DetalleCita({ cita, ocupado, onMover, onCambiar, onCerrar }) {
  const meta = statusMeta(cita.status)
  const acciones = accionesPara(cita.status)
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tabular text-sm font-semibold text-sand-700">
            {cita.startTime} a {cita.endTime}
          </p>
          <p className="mt-1 text-lg font-semibold leading-snug text-sand-900">{cita.clientName}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el detalle"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-sand-700 transition-colors hover:bg-sand-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <span className={`chip mt-2 ${meta.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
        {meta.label}
      </span>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div>
          <dt className="text-sand-600">Servicio</dt>
          <dd className="font-medium text-sand-900">{cita.servicesLabel}</dd>
        </div>
        <div>
          <dt className="text-sand-600">Profesional</dt>
          <dd className="font-medium text-sand-900">{cita.professionalName}</dd>
        </div>
        {cita.clientPhone && (
          <div>
            <dt className="text-sand-600">Teléfono</dt>
            <dd>
              <a
                href={`https://wa.me/${cita.clientPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary-800 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-700"
              >
                {cita.clientPhone}
              </a>
            </dd>
          </div>
        )}
        {cita.totalPrice > 0 && (
          <div>
            <dt className="text-sand-600">Total</dt>
            <dd className="tabular font-semibold text-sand-900">{formatGs(cita.totalPrice)}</dd>
          </div>
        )}
        {cita.notes && (
          <div>
            <dt className="text-sand-600">Nota</dt>
            <dd className="text-sand-900">{cita.notes}</dd>
          </div>
        )}
      </dl>

      {acciones.length > 0 && (
        <div className="mt-5 grid gap-2">
          {acciones.map((a) => (
            <button
              key={a.to}
              type="button"
              disabled={ocupado}
              onClick={() => onCambiar(a.to)}
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
          <button type="button" disabled={ocupado} onClick={onMover} className="btn-outline">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Mover
          </button>
        </div>
      )}
    </div>
  )
}
