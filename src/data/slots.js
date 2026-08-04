import { addMinutesToTime } from '../utils/format'

/**
 * Genera los horarios disponibles de un profesional para una fecha.
 * Reglas compartidas del modo demo (en Supabase esto vive en SQL).
 *
 * @param {Object} args
 * @param {Array}  args.workingHours   [{weekday 0-6, start "08:00", end "18:00"}]
 * @param {Array}  args.appointments   citas del profesional ese día (no canceladas)
 * @param {string} args.dateKey        "yyyy-MM-dd"
 * @param {number} args.durationMin    duración del servicio a reservar
 * @param {number} args.intervalMin    intervalo de slots del profesional
 * @returns {string[]} ["08:00", "08:30", ...]
 */
export function computeDaySlots({ workingHours, appointments, dateKey, durationMin, intervalMin }) {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay()
  const ranges = workingHours.filter((w) => w.weekday === weekday)
  if (ranges.length === 0) return []

  const busy = appointments
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
      const overlaps = busy.some((b) => t < b.end && end > b.start)
      const past = isToday && t <= nowMin
      if (!overlaps && !past) slots.push(fromMin(t))
    }
  }
  return slots
}

function toMin(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMin(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export { addMinutesToTime }
