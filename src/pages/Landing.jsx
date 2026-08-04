import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  Layers,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { isDemoMode } from '../api/backend'
import { DEMO_CREDENTIALS } from '../data/demoData'

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Reservá en cuatro pasos',
    body: 'Servicio, profesional, día y hora. Sin llamadas, sin esperar respuesta, sin idas y vueltas por chat.',
  },
  {
    icon: Clock,
    title: 'Solo horarios reales',
    body: 'La agenda muestra únicamente los huecos libres del profesional. Lo que ves disponible, está disponible.',
  },
  {
    icon: Layers,
    title: 'Tus paquetes al día',
    body: 'Cada sesión que usás se descuenta sola. Siempre sabés cuántas te quedan y cuánto falta pagar.',
  },
  {
    icon: BellRing,
    title: 'Confirmá desde el link',
    body: 'Recordatorios con un link directo para confirmar o cancelar. Sin entrar a la cuenta si no querés.',
  },
  {
    icon: Smartphone,
    title: 'Pensado para el celular',
    body: 'Botones grandes, contraste alto y todo a una mano. Funciona igual de bien en la compu.',
  },
  {
    icon: ShieldCheck,
    title: 'Tus datos, tuyos',
    body: 'Cada negocio ve solo su propia agenda. Accesos separados y permisos por fila en la base.',
  },
]

const STEPS = [
  { n: '01', title: 'Elegí el servicio', body: 'Buscá por nombre o categoría, o usá una sesión de tu paquete activo.' },
  { n: '02', title: 'Elegí quién te atiende', body: 'Filtramos solo los profesionales que hacen ese servicio.' },
  { n: '03', title: 'Elegí día y hora', body: 'El calendario marca los días con lugar y te muestra los horarios libres.' },
  { n: '04', title: 'Confirmá', body: 'Repasás el resumen, dejás una nota si querés y listo. Queda reservada.' },
]

export default function Landing() {
  return (
    <div className="min-h-dvh bg-sand-50">
      <header className="border-b border-sand-200 bg-white">
        <div className="container-app flex h-16 items-center justify-between">
          <Logo subtitle="Portal de citas" />
          <Link to="/ingresar" className="btn-primary">
            Ingresar
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary-950">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary-800/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl"
          />

          <div className="container-app relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div>
              <span className="chip bg-primary-800 text-accent-300">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Portal de agendamiento
              </span>

              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Tu agenda,
                <br />
                siempre <span className="text-accent-400">en orden</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-100 sm:text-lg">
                Reservá tu próxima cita cuando quieras, sin llamar ni esperar respuesta.
                Acá ves los horarios que tu profesional tiene libres de verdad.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/ingresar" className="btn-accent px-6 py-3 text-base">
                  Ingresar a mi cuenta
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#como-funciona" className="btn px-6 py-3 text-base text-white ring-1 ring-inset ring-primary-700 hover:bg-primary-900">
                  Ver cómo funciona
                </a>
              </div>

              {isDemoMode && (
                <p className="mt-6 rounded-xl border border-primary-800 bg-primary-900/60 px-4 py-3 text-sm text-primary-100">
                  <span className="font-semibold text-accent-300">Modo demo:</span>{' '}
                  <span className="tabular">{DEMO_CREDENTIALS.email}</span> ·{' '}
                  <span className="tabular">{DEMO_CREDENTIALS.password}</span>
                </p>
              )}
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* Beneficios */}
        <section className="container-app py-16 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Toda tu agenda, en un solo lugar
            </h2>
            <p className="mt-3 text-base text-sand-600">
              Sin instalar nada. Entrás con tu email y tenés tu historial, tus paquetes y lo que viene.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card transition-shadow duration-200 hover:shadow-lifted">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-sand-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sand-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="border-y border-sand-200 bg-white py-16 lg:py-24">
          <div className="container-app">
            <h2 className="max-w-2xl font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Reservar son cuatro pasos
            </h2>

            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ n, title, body }) => (
                <li key={n} className="relative border-t-2 border-primary-200 pt-5">
                  <span className="font-display text-sm font-extrabold tabular text-accent-600">{n}</span>
                  <h3 className="mt-1 font-display text-lg font-bold text-sand-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-sand-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cierre */}
        <section className="container-app py-16 lg:py-24">
          <div className="overflow-hidden rounded-3xl bg-primary-900 px-6 py-12 text-center sm:px-12 lg:py-16">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Tu próxima cita te espera
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-primary-100">
              Ingresá con tu email y elegí el horario que mejor te venga.
            </p>
            <ul className="mx-auto mt-7 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-primary-100">
              {['Sin instalar nada', 'A cualquier hora', 'Cancelás sin llamar'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-accent-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/ingresar" className="btn-accent mt-8 px-6 py-3 text-base">
              Ingresar a Agendik
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-200 bg-white py-8">
        <div className="container-app flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo subtitle="Portal de citas" />
          <p className="text-xs text-sand-500">Horarios en zona América/Asunción</p>
        </div>
      </footer>
    </div>
  )
}

/** Maqueta estática de la app — muestra el producto sin capturas de pantalla */
function HeroPreview() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="rounded-3xl border border-primary-800 bg-white p-4 shadow-lifted sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-bold text-sand-900">Próxima cita</p>
            <p className="text-xs text-sand-500">Estudio Alma</p>
          </div>
          <span className="chip bg-emerald-100 text-emerald-700">Confirmada</span>
        </div>

        <div className="mt-4 rounded-2xl bg-sand-50 p-4">
          <p className="font-display text-base font-bold text-sand-900">Limpieza Facial Profunda</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sand-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary-600" />
              Jueves, 6 de agosto
            </span>
            <span className="flex items-center gap-1.5 tabular">
              <Clock className="h-3.5 w-3.5 text-primary-600" />
              10:00 – 11:00
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((t, i) => (
            <span
              key={t}
              className={`rounded-lg py-2 text-center text-xs font-semibold tabular ${
                i === 4
                  ? 'bg-primary-800 text-white'
                  : i === 2 || i === 6
                    ? 'bg-sand-100 text-sand-300 line-through'
                    : 'bg-white text-sand-700 ring-1 ring-inset ring-sand-200'
              }`}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-primary-800">Pack Facial Glow</p>
            <p className="text-xs text-primary-700">3 de 4 sesiones disponibles</p>
          </div>
          <span className="font-display text-lg font-extrabold tabular text-primary-800">3/4</span>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="rounded-2xl border border-primary-800 bg-white px-4 py-2.5 shadow-lifted">
          <p className="text-xs text-sand-500">Reservada desde</p>
          <p className="font-display text-lg font-extrabold text-primary-800">el celular</p>
        </div>
      </div>
    </div>
  )
}
