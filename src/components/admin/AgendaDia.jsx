import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { UserPlus } from 'lucide-react'
import { statusMeta } from '../../utils/appointments'
import { initials, toDateKey } from '../../utils/format'

/*
 * Agenda de un día con una columna por profesional, como el calendario de Fresha o Square:
 * cada cita es un bloque que ocupa su duración real. Solo escritorio (en el celular se usa la lista).
 */

const PX_POR_MINUTO = 1.2 // una hora = 72 px
const ALTO_MINIMO = 24 // px: hasta un turno de 15 minutos se puede tocar (WCAG 2.5.8)

const minutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Color por estado: borde de 1px y fondo suave (nada de franjas laterales gruesas).
const BLOQUE = {
  reserved: 'border-accent-400 bg-accent-50 hover:bg-accent-100',
  confirmed: 'border-primary-500 bg-primary-50 hover:bg-primary-100',
  completed: 'border-sand-300 bg-sand-100 hover:bg-sand-200',
}

/** Reparte en carriles las citas que se pisan dentro de una misma columna (clases grupales, sobreturnos). */
function enCarriles(citas) {
  const orden = [...citas].sort((a, b) => minutos(a.startTime) - minutos(b.startTime))
  const resultado = []
  let grupo = []
  let finDelGrupo = -1
  const cerrarGrupo = () => {
    const total = Math.max(...grupo.map((g) => g.carril)) + 1
    for (const g of grupo) resultado.push({ ...g, total })
    grupo = []
  }
  for (const cita of orden) {
    const inicio = minutos(cita.startTime)
    if (grupo.length && inicio >= finDelGrupo) cerrarGrupo()
    const ocupados = new Set(grupo.filter((g) => minutos(g.cita.endTime) > inicio).map((g) => g.carril))
    let carril = 0
    while (ocupados.has(carril)) carril += 1
    grupo.push({ cita, carril })
    finDelGrupo = Math.max(grupo.length > 1 ? finDelGrupo : -1, minutos(cita.endTime))
  }
  if (grupo.length) cerrarGrupo()
  return resultado
}

export default function AgendaDia({ fecha, citas, profesionales, seleccionada, onSeleccionar }) {
  const activas = useMemo(() => citas.filter((c) => c.status !== 'cancelled'), [citas])

  // Todo el equipo, tenga o no citas; y quien tenga citas aunque ya no esté activo.
  const columnas = useMemo(() => {
    const lista = profesionales.map((p) => ({ id: p.id, name: p.name }))
    for (const c of activas) {
      if (!lista.some((p) => p.id === c.professionalId)) lista.push({ id: c.professionalId, name: c.professionalName })
    }
    return lista
  }, [profesionales, activas])

  // De 08:00 a 20:00 como mínimo; se estira si hay citas antes o después.
  const inicio = Math.floor(Math.min(8 * 60, ...activas.map((c) => minutos(c.startTime))) / 60) * 60
  const fin = Math.ceil(Math.max(20 * 60, ...activas.map((c) => minutos(c.endTime))) / 60) * 60
  const alto = (fin - inicio) * PX_POR_MINUTO
  const horas = []
  for (let m = inicio; m < fin; m += 60) horas.push(m)

  const esHoy = toDateKey(new Date()) === toDateKey(fecha)
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    if (!esHoy) return undefined
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [esHoy])
  const minutoActual = ahora.getHours() * 60 + ahora.getMinutes()

  // Al abrir el día, la vista arranca una hora antes de la hora actual (hoy) o de la primera cita.
  const desplazable = useRef(null)
  const primera = activas.length ? Math.min(...activas.map((c) => minutos(c.startTime))) : 9 * 60
  useEffect(() => {
    const objetivo = esHoy ? minutoActual : primera
    if (desplazable.current) desplazable.current.scrollTop = Math.max(0, (objetivo - inicio - 60) * PX_POR_MINUTO)
    // Solo al cambiar de día: no mover la vista mientras se trabaja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toDateKey(fecha)])

  const lineasHora = PX_POR_MINUTO * 60

  // Negocio recién creado: sin equipo no hay columnas que mostrar; se explica qué falta en vez de una grilla vacía.
  if (columnas.length === 0) {
    return (
      <section
        aria-label="Agenda del día por profesional"
        className="flex flex-col items-start gap-4 rounded-2xl border border-sand-200 bg-white p-8"
      >
        <p className="text-lg font-semibold text-primary-950">Todavía no hay profesionales en tu equipo.</p>
        <p className="max-w-md text-base text-sand-700">
          La agenda muestra una columna por cada persona que atiende. Sumá a tu equipo y sus horarios para empezar.
        </p>
        <Link to="/profesionales" className="btn-primary">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Sumar profesionales
        </Link>
      </section>
    )
  }
  const fondo = {
    height: alto,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${lineasHora - 1}px, oklch(var(--sand-200)) ${
      lineasHora - 1
    }px ${lineasHora}px), repeating-linear-gradient(to bottom, transparent 0 ${lineasHora / 2 - 1}px, oklch(var(--sand-100)) ${
      lineasHora / 2 - 1
    }px ${lineasHora / 2}px)`,
  }

  return (
    <section aria-label="Agenda del día por profesional" className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
      <div ref={desplazable} className="max-h-[72vh] overflow-auto">
        <div
          className="grid min-w-full"
          style={{ gridTemplateColumns: `4.5rem repeat(${Math.max(columnas.length, 1)}, minmax(11rem, 1fr))` }}
        >
          {/* Encabezado fijo: quién atiende */}
          <div className="sticky top-0 z-20 border-b border-sand-200 bg-white" />
          {columnas.map((p) => {
            const cuantas = activas.filter((c) => c.professionalId === p.id).length
            return (
              <div
                key={p.id}
                className="sticky top-0 z-20 flex min-w-0 items-center gap-2.5 border-b border-l border-sand-200 bg-white px-3 py-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[0.8125rem] font-bold text-primary-900"
                >
                  {initials(p.name)}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold text-sand-900">{p.name}</span>
                  <span className="block text-[0.8125rem] text-sand-600">
                    {cuantas} {cuantas === 1 ? 'cita' : 'citas'}
                  </span>
                </span>
              </div>
            )
          })}

          {/* Columna de horas */}
          <div className="relative" style={{ height: alto }} aria-hidden="true">
            {horas.map((m, i) => (
              <span
                key={m}
                className={`tabular absolute right-2 text-[0.8125rem] text-sand-600 ${i === 0 ? 'mt-1' : '-translate-y-1/2'}`}
                style={{ top: (m - inicio) * PX_POR_MINUTO }}
              >
                {aHora(m)}
              </span>
            ))}
          </div>

          {/* Una columna por profesional */}
          {columnas.map((p) => (
            <div key={p.id} className="relative border-l border-sand-200" style={fondo}>
              {enCarriles(activas.filter((c) => c.professionalId === p.id)).map(({ cita, carril, total }) => {
                const desde = minutos(cita.startTime)
                const duracion = minutos(cita.endTime) - desde
                const elegida = seleccionada === cita.id
                return (
                  <button
                    key={cita.id}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => onSeleccionar(elegida ? null : cita.id)}
                    className={`absolute cursor-pointer overflow-hidden rounded-lg border px-2 py-1 text-left transition-colors duration-150 ${
                      BLOQUE[cita.status] || BLOQUE.reserved
                    } ${elegida ? 'z-10 ring-2 ring-primary-800 ring-offset-1' : ''}`}
                    style={{
                      top: (desde - inicio) * PX_POR_MINUTO + 1,
                      height: Math.max(duracion * PX_POR_MINUTO - 2, ALTO_MINIMO),
                      left: `calc(${(carril * 100) / total}% + 3px)`,
                      width: `calc(${100 / total}% - 6px)`,
                    }}
                  >
                    {duracion < 60 ? (
                      // Turno corto: hora y nombre en una línea para que el servicio entre debajo.
                      <span className="block truncate text-sm font-semibold leading-tight text-primary-950">
                        <span className="tabular font-semibold text-sand-800">{cita.startTime}</span> {cita.clientName}
                      </span>
                    ) : (
                      <>
                        <span className="tabular block text-[0.8125rem] font-semibold leading-tight text-sand-800">
                          {cita.startTime} a {cita.endTime}
                        </span>
                        <span className="block truncate text-sm font-semibold leading-tight text-primary-950">{cita.clientName}</span>
                      </>
                    )}
                    <span className="block truncate text-[0.8125rem] leading-tight text-sand-700">{cita.servicesLabel}</span>
                    <span className="sr-only">, {statusMeta(cita.status).label}</span>
                  </button>
                )
              })}

              {esHoy && minutoActual >= inicio && minutoActual <= fin && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-600"
                  style={{ top: (minutoActual - inicio) * PX_POR_MINUTO }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
