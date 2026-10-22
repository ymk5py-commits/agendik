import { CalendarDays, Check, Clock, MailCheck } from 'lucide-react'

/*
 * Maquetas del producto para la landing. Son ilustraciones hechas con la propia interfaz (no capturas):
 * contenido de ejemplo, ocultas a lectores de pantalla (`aria-hidden`) y sin interacción.
 */

/**
 * Motivo de la superficie oscura: grilla de agenda (renglones horarios y columnas de días) con unos
 * pocos bloques reservados. Los bloques caen sobre las líneas de la grilla (renglón 56px, columna 120px).
 */
const BLOQUES = [
  { left: 720, top: 112, h: 104 },
  { left: 960, top: 224, h: 160 },
  { left: 1080, top: 56, h: 48 },
  { left: 840, top: 336, h: 104 },
  { left: 1200, top: 280, h: 104 },
]

export function AgendaBackdrop({ className = '', bloques = true }) {
  const mask = 'linear-gradient(to left, black 0%, black 30%, transparent 78%)'
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="agenda-grid absolute inset-0"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      />
      {bloques && (
        <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
          {BLOQUES.map(({ left, top, h }) => (
            <span
              key={`${left}-${top}`}
              className="absolute w-[112px] rounded-lg bg-primary-800/60"
              style={{ left: left + 4, top: top + 4, height: h - 8 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const DIAS = [
  { d: 'Lun', n: 5 },
  { d: 'Mar', n: 6 },
  { d: 'Mié', n: 7, activo: true },
  { d: 'Jue', n: 8 },
  { d: 'Vie', n: 9 },
]
const HORAS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
const OCUPADAS = new Set(['09:00', '11:00'])

/** Héroe: el paso 3 de la reserva (día y hora), que es lo más reconocible del producto. */
export function BookingPreview({ negocio }) {
  return (
    <div aria-hidden="true" className="relative">
      <div className="rounded-3xl bg-white p-5 shadow-lifted sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-primary-950">Elegí tu horario</p>
            <p className="mt-0.5 truncate text-sm text-sand-600">Limpieza facial profunda · 60 min</p>
          </div>
          <span className="chip shrink-0 bg-primary-100 text-primary-800">Paso 3 de 4</span>
        </div>

        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 3 ? 'bg-primary-700' : 'bg-sand-200'}`} />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {DIAS.map(({ d, n, activo }) => (
            <span
              key={n}
              className={`rounded-xl py-2.5 text-center ${activo ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-800'}`}
            >
              <span className={`block text-[0.8125rem] ${activo ? 'text-primary-100' : 'text-sand-600'}`}>{d}</span>
              <span className="tabular block font-display text-lg font-bold leading-tight">{n}</span>
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {HORAS.map((h) => {
            const activa = h === '10:00'
            const ocupada = OCUPADAS.has(h)
            return (
              <span
                key={h}
                className={`tabular rounded-lg py-2.5 text-center text-sm font-semibold ${
                  activa
                    ? 'bg-primary-800 text-white'
                    : ocupada
                      ? 'bg-sand-100 text-sand-500 line-through'
                      : 'bg-white text-sand-800 ring-1 ring-inset ring-edge'
                }`}
              >
                {h}
              </span>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-primary-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5 text-sm text-primary-900">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary-600" />
            <span className="tabular truncate font-medium">Miércoles 7, 10:00</span>
          </div>
          <span className="chip shrink-0 bg-emerald-100 text-emerald-800">
            <Check className="h-3 w-3" /> Libre
          </span>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-3 hidden items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-lifted sm:flex lg:-left-10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <MailCheck className="h-4 w-4" />
        </span>
        <span className="text-sm leading-tight text-sand-800">
          Confirmación en tu mail
          <span className="block text-sand-600">de {negocio}</span>
        </span>
      </div>
    </div>
  )
}

const Marco = ({ children, className = '' }) => (
  <div
    aria-hidden="true"
    className={`rounded-2xl border border-sand-200 bg-white p-4 shadow-soft sm:p-5 ${className}`}
  >
    {children}
  </div>
)

const SERVICIOS = [
  { n: 'Limpieza facial profunda', m: '60 min', sel: true },
  { n: 'Masaje relajante', m: '60 min' },
  { n: 'Manicura spa', m: '45 min' },
]

/** Paso 1: elegir el servicio. */
export function StepServicio() {
  return (
    <Marco>
      <div className="flex flex-wrap gap-2">
        {['Faciales', 'Corporales', 'Manos y pies'].map((c, i) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              i === 0 ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-700'
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {SERVICIOS.map(({ n, m, sel }) => (
          <li
            key={n}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
              sel ? 'bg-primary-50 ring-2 ring-primary-600' : 'ring-1 ring-inset ring-sand-200'
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-sand-900">{n}</span>
              <span className="tabular flex items-center gap-1.5 text-sm text-sand-600">
                <Clock className="h-3.5 w-3.5" /> {m}
              </span>
            </span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                sel ? 'bg-primary-800 text-white' : 'ring-1 ring-inset ring-edge'
              }`}
            >
              {sel && <Check className="h-3.5 w-3.5" />}
            </span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

const PROFESIONALES = [
  { n: 'Cynthia T.', i: 'CT', sel: true },
  { n: 'Rocío F.', i: 'RF' },
  { n: 'Lucía M.', i: 'LM' },
]

/** Paso 2: elegir quién atiende (solo aparecen quienes hacen ese servicio). */
export function StepProfesional() {
  return (
    <Marco>
      <p className="text-sm text-sand-600">Hacen limpieza facial profunda</p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {PROFESIONALES.map(({ n, i, sel }) => (
          <li
            key={n}
            className={`rounded-xl px-2 py-4 text-center ${
              sel ? 'bg-primary-50 ring-2 ring-primary-600' : 'ring-1 ring-inset ring-sand-200'
            }`}
          >
            <span
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold ${
                sel ? 'bg-primary-800 text-white' : 'bg-sand-100 text-sand-700'
              }`}
            >
              {i}
            </span>
            <span className="mt-2 block text-sm font-medium text-sand-900">{n}</span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

// Octubre de ejemplo: lunes a domingo. 0 = sin lugar, 1 = con lugar, 2 = elegido.
const MES = [
  [0, 1, 1, 2, 1, 1, 0],
  [0, 1, 0, 1, 1, 1, 0],
  [0, 1, 1, 1, 0, 1, 0],
]
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Paso 3: el calendario marca los días con lugar. */
export function StepFecha() {
  return (
    <Marco>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-base font-bold text-primary-950">Octubre</p>
        <p className="text-sm text-sand-600">Los días con lugar están marcados</p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {SEMANA.map((d, i) => (
          <span key={i} className="text-[0.8125rem] font-medium text-sand-600">
            {d}
          </span>
        ))}
        {MES.flat().map((estado, i) => (
          <span
            key={i}
            className={`tabular rounded-lg py-2 text-sm font-semibold ${
              estado === 2
                ? 'bg-primary-800 text-white'
                : estado === 1
                  ? 'bg-primary-50 text-primary-900'
                  : 'text-sand-500'
            }`}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </Marco>
  )
}

/** Paso 4: resumen y confirmación. */
export function StepConfirmar() {
  const filas = [
    ['Servicio', 'Limpieza facial profunda'],
    ['Con', 'Cynthia T.'],
    ['Día', 'Jueves 4'],
    ['Hora', '10:00 a 11:00'],
  ]
  return (
    <Marco>
      <dl className="divide-y divide-sand-200">
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
            <dt className="text-sm text-sand-600">{k}</dt>
            <dd className="tabular text-right text-sm font-semibold text-sand-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-primary-800 px-5 text-sm font-semibold text-white">
        Confirmar turno
      </div>
      <p className="mt-3 flex items-start gap-2 text-sm text-sand-600">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        Te llega la confirmación por mail, con un link para cambiarla o cancelarla.
      </p>
    </Marco>
  )
}

/** "Mis citas": la próxima cita y el avance del paquete. */
export function MisCitasPreview() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-sand-600">Próxima cita</p>
            <p className="mt-0.5 font-display text-lg font-bold text-primary-950">Limpieza facial profunda</p>
          </div>
          <span className="chip shrink-0 bg-emerald-100 text-emerald-800">Confirmada</span>
        </div>
        <p className="tabular mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sand-700">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-primary-600" /> Jueves 4 de octubre
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary-600" /> 10:00 a 11:00
          </span>
        </p>
        <div className="mt-4 flex gap-2">
          <span className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-edge text-sm font-semibold text-sand-800">Reprogramar</span>
          <span className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-edge text-sm font-semibold text-sand-800">Cancelar</span>
        </div>
      </div>

      <div className="rounded-2xl bg-primary-50 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-primary-900">Pack facial</p>
          <p className="tabular font-display text-2xl font-extrabold text-primary-800">
            3<span className="text-primary-600">/4</span>
          </p>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < 3 ? 'bg-primary-700' : 'bg-primary-200'}`} />
          ))}
        </div>
        <p className="mt-2 text-sm text-primary-800">3 de 4 sesiones disponibles</p>
      </div>
    </div>
  )
}
