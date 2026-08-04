/** Metadatos de estado de cita: etiqueta y estilos de badge */
export const STATUS_META = {
  reserved: { label: 'Reservada', chip: 'bg-accent-100 text-accent-800', dot: 'bg-accent-500' },
  confirmed: { label: 'Confirmada', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelada', chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  completed: { label: 'Completada', chip: 'bg-sand-100 text-sand-600', dot: 'bg-sand-400' },
}

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.reserved
}

/** ¿La cita está en el futuro? (fecha + hora de inicio) */
export function isUpcoming(appt) {
  const dt = new Date(`${appt.date}T${appt.startTime}:00`)
  return dt.getTime() > Date.now()
}

/** ¿Se puede cancelar? Futura y no cancelada/completada */
export function isCancellable(appt) {
  return isUpcoming(appt) && ['reserved', 'confirmed'].includes(appt.status)
}

/** Orden cronológico ascendente */
export function byDateTimeAsc(a, b) {
  return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)
}

/** Orden cronológico descendente */
export function byDateTimeDesc(a, b) {
  return byDateTimeAsc(b, a)
}
