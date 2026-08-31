import { addMinutesToTime } from '../utils/format'

/**
 * Genera los horarios disponibles de un profesional para una fecha.
 * Reglas compartidas del modo demo (en Supabase esto vive en SQL).
 *
 * Con `capacity` mayor a 1 el turno es una clase grupal: varias personas
 * comparten el mismo horario de inicio, y el hueco sigue apareciendo hasta
 * que se llena. Con capacity 1 se comporta como siempre.
 *
 * @param {Object} args
 * @param {Array}  args.workingHours   [{weekday 0-6, start "08:00", end "18:00"}]
 * @param {Array}  args.appointments   citas del profesional ese día (no canceladas)
 * @param {string} args.dateKey        "yyyy-MM-dd"
 * @param {number} args.durationMin    duración del servicio a reservar
 * @param {number} args.intervalMin    intervalo de slots del profesional
 * @param {number} [args.capacity=1]   personas por turno del servicio elegido
 * @returns {Array<{time: string, libres: number, capacidad: number}>}
 */
export function computeDaySlots({
  workingHours,
  appointments,
  dateKey,
  durationMin,
  intervalMin,
  capacity = 1,
}) {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay()
  const ranges = workingHours.filter((w) => w.weekday === weekday)
  if (ranges.length === 0) return []

  const ocupadas = appointments
    .filter((a) => a.date === dateKey && ['reserved', 'confirmed'].includes(a.status))
    .map((a) => ({ start: toMin(a.startTime), end: toMin(a.endTime) }))

  const now = new Date()
  const isToday = dateKey === now.toISOString().slice(0, 10)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const slots = []
  for (const range of ranges) {
    const open = toMin(range.start)
    const close = toMin(range.end)

    for (let t = open; t + durationMin <= close; t += intervalMin) {
      const end = t + durationMin
      if (isToday && t <= nowMin) continue

      const solapadas = ocupadas.filter((b) => t < b.end && end > b.start)

      if (capacity > 1) {
        // Las que arrancan a otra hora bloquean igual: el profesional no
        // puede estar en dos clases a la vez.
        const enOtroHorario = solapadas.filter((b) => b.start !== t)
        if (enOtroHorario.length > 0) continue

        const inscriptas = solapadas.length
        if (inscriptas >= capacity) continue
        slots.push({ time: fromMin(t), libres: capacity - inscriptas, capacidad: capacity })
      } else {
        if (solapadas.length > 0) continue
        slots.push({ time: fromMin(t), libres: 1, capacidad: 1 })
      }
    }
  }
  return slots
}

/** Solo las horas, para quien no necesita el detalle de cupos. */
export function soloHorarios(slots) {
  return slots.map((s) => (typeof s === 'string' ? s : s.time))
}

function toMin(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMin(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export { addMinutesToTime }
