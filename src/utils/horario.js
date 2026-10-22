/** Horario de atención de un negocio, siempre en hora de Asunción (la de la agenda), sin importar dónde esté quien mira. */

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** De lunes a domingo, como se lee una semana en Paraguay (weekday 0 = domingo). */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

const NUMERO_DE_DIA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function ahoraEnAsuncion(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value
  return { dia: NUMERO_DE_DIA[valor('weekday')], hora: `${valor('hour')}:${valor('minute')}` }
}

/**
 * «Abierto ahora · hasta las 20:00» o «Cerrado · abre mañana a las 08:00».
 * `horarios` = [{ weekday, start, end }] con horas «HH:MM». null si el negocio no cargó horarios.
 */
export function estadoDelNegocio(horarios, ahora = ahoraEnAsuncion()) {
  if (!horarios?.length) return null
  const porDia = new Map(horarios.map((h) => [h.weekday, h]))
  const hoy = porDia.get(ahora.dia)

  if (hoy && ahora.hora >= hoy.start && ahora.hora < hoy.end) {
    return { abierto: true, texto: `Abierto ahora · hasta las ${hoy.end}` }
  }
  if (hoy && ahora.hora < hoy.start) {
    return { abierto: false, texto: `Cerrado · abre hoy a las ${hoy.start}` }
  }
  for (let i = 1; i <= 7; i += 1) {
    const dia = (ahora.dia + i) % 7
    const proximo = porDia.get(dia)
    if (proximo) {
      const cuando = i === 1 ? 'mañana' : `el ${DIAS[dia].toLowerCase()}`
      return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${proximo.start}` }
    }
  }
  return null
}
