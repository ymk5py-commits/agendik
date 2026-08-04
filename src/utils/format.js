import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/** Guaraní paraguayo, sin decimales: 150000 → "150.000 Gs." */
export function formatGs(amount) {
  const n = Number(amount || 0)
  return `${n.toLocaleString('es-PY').replace(/,/g, '.')} Gs.`
}

/** "2026-08-11" → "lunes, 11 agosto 2026" */
export function formatLongDate(dateStr) {
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  return format(d, "EEEE, d 'de' MMMM yyyy", { locale: es })
}

/** "2026-08-11" → "11 ago" */
export function formatShortDate(dateStr) {
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  return format(d, 'd MMM', { locale: es })
}

/** Date → "yyyy-MM-dd" (clave estándar interna) */
export function toDateKey(date) {
  return format(date, 'yyyy-MM-dd')
}

/** "08:30" + 60 min → "09:30" */
export function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Duración en minutos → "1 h 30 min" */
export function formatDuration(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Iniciales para avatares: "Ana María Duarte" → "AD" */
export function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
