import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, MessageCircle } from 'lucide-react'
import { useTenant } from '../context/TenantContext'
import { useReveal } from '../hooks/useReveal'
import { Logo, LogoMark } from '../components/Logo'
import { BusinessMark } from '../components/BusinessMark'
import {
  AgendaBackdrop,
  BookingPreview,
  MisCitasPreview,
  StepConfirmar,
  StepFecha,
  StepProfesional,
  StepServicio,
} from '../components/landing/Fragments'
import { isDemoMode } from '../api/backend'
import { DEMO_CREDENTIALS } from '../data/demoData'

/*
 * Landing del portal de un negocio (/n/<slug>).
 * Estructura: «Narrative Workflow» (la reserva en cuatro pasos es la columna vertebral), asimétrica, con la
 * maqueta del producto como imagen. El protagonista es el negocio; Agendik queda como firma al pie.
 */

const PASOS = [
  {
    n: 1,
    titulo: 'Elegí el servicio',
    texto: 'Buscá por nombre o por categoría. Si tenés un paquete activo, podés usar una de sus sesiones.',
    Maqueta: StepServicio,
  },
  {
    n: 2,
    titulo: 'Elegí quién te atiende',
    texto: 'Te mostramos solo a las personas que hacen ese servicio, para que no pierdas tiempo.',
    Maqueta: StepProfesional,
  },
  {
    n: 3,
    titulo: 'Elegí día y hora',
    texto: 'El calendario marca los días con lugar y te muestra los horarios libres de verdad.',
    Maqueta: StepFecha,
  },
  {
    n: 4,
    titulo: 'Confirmá',
    texto: 'Repasás el resumen, dejás una nota si querés y listo. La cita queda reservada.',
    Maqueta: StepConfirmar,
  },
]

const BENEFICIOS = [
  ['Solo horarios libres', 'Ves únicamente los huecos reales de cada profesional. Lo que aparece disponible, está disponible.'],
  ['Tus paquetes, al día', 'Cada sesión que usás se descuenta sola, y siempre sabés cuántas te quedan.'],
  ['Confirmás desde el mail', 'Te llega un link para confirmar o cancelar, sin tener que entrar a tu cuenta.'],
  ['Hecho para el celular', 'Botones grandes y todo a una mano. En la compu funciona igual de bien.'],
]

/** Número de WhatsApp en formato wa.me (solo dígitos); null si el negocio no cargó uno usable. */
function enlaceWhatsApp(telefono) {
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  return digitos.length >= 8 ? `https://wa.me/${digitos}` : null
}

export default function Landing() {
  const { tenant, slug, loading } = useTenant()
  useReveal([tenant?.id])

  if (loading) {
    return <div className="min-h-dvh bg-sand-50" />
  }

  // El link que le pasaron apunta a un negocio que no existe (o cambió de
  // dirección). Mejor decirlo que mostrar un portal vacío.
  if (!tenant) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-sand-50 px-6 text-center">
        <Logo subtitle="Portal de citas" />
        <h1 className="mt-4 font-display text-2xl font-bold text-sand-900">No encontramos este negocio</h1>
        <p className="max-w-sm text-base text-sand-600">
          Revisá el link que te pasaron: la dirección <strong>{slug}</strong> no corresponde a ningún negocio.
        </p>
      </div>
    )
  }

  const ingresar = `/n/${slug}/ingresar`
  const registro = `/n/${slug}/ingresar?registro=1`
  const whatsapp = enlaceWhatsApp(tenant.phone)

  return (
    <div className="min-h-dvh bg-sand-50">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-primary-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      {/* ───────── Héroe: superficie petróleo, con el nombre del negocio como protagonista ───────── */}
      <section className="surface-dark relative bg-primary-950 pb-20 lg:pb-28">
        <AgendaBackdrop />

        <header className="container-app relative flex h-20 items-center justify-between gap-4">
          <Link to={`/n/${slug}`} className="flex min-w-0 items-center gap-3 rounded-lg">
            <BusinessMark name={tenant.businessName} tone="light" />
            <span className="truncate font-display text-lg font-bold tracking-tight text-white">
              {tenant.businessName}
            </span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-2 sm:gap-4">
            <a
              href="#como-reservar"
              className="hidden min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-primary-100 transition-colors hover:text-white sm:inline-flex"
            >
              Cómo reservar
            </a>
            <Link to={ingresar} className="btn-on-dark">
              Ingresar
            </Link>
          </nav>
        </header>

        <div className="container-app relative grid grid-cols-1 gap-14 pt-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-16">
          <div className="lg:col-span-7">
            <h1
              id="contenido"
              className="animate-reveal min-w-0 text-balance font-display text-display-s font-extrabold text-white [overflow-wrap:anywhere] sm:text-display"
              style={{ '--i': 0 }}
            >
              Reservá tu turno en <span className="text-accent-400">{tenant.businessName}</span>
            </h1>

            <p
              className="animate-reveal mt-6 max-w-[34rem] text-lg leading-relaxed text-primary-100 sm:text-xl"
              style={{ animationDelay: '90ms' }}
            >
              Elegí el servicio, quién te atiende y el horario. Ves solo lugares libres y recibís la confirmación por mail.
            </p>

            <div className="animate-reveal mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '180ms' }}>
              <Link to={ingresar} className="btn-accent btn-lg">
                Ingresar para reservar
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <a href="#como-reservar" className="btn-on-dark btn-lg">
                Ver cómo funciona
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>

            <p className="animate-reveal mt-5 text-base text-primary-200" style={{ animationDelay: '240ms' }}>
              ¿Primera vez?{' '}
              <Link
                to={registro}
                className="font-semibold text-white underline decoration-primary-400 underline-offset-4 transition-colors hover:decoration-accent-300"
              >
                Creá tu cuenta con tu email
              </Link>
              .
            </p>

            {isDemoMode && (
              <p className="mt-6 max-w-md rounded-xl border border-primary-700 bg-primary-900 px-4 py-3 text-sm text-primary-100">
                <span className="font-semibold text-accent-300">Modo demo:</span>{' '}
                <span className="tabular">{DEMO_CREDENTIALS.email}</span> ·{' '}
                <span className="tabular">{DEMO_CREDENTIALS.password}</span>
              </p>
            )}
          </div>

          {/* La maqueta y su aviso flotante rompen la grilla: el aviso sale del borde de la tarjeta */}
          <div className="animate-reveal lg:col-span-5" style={{ animationDelay: '260ms' }}>
            <BookingPreview negocio={tenant.businessName} />
          </div>
        </div>
      </section>

      {/* ───────── Cómo reservar ───────── */}
      <main>
        <section id="como-reservar" className="container-app scroll-mt-4 pb-8 pt-20 lg:pb-12 lg:pt-32">
          <div className="reveal max-w-2xl">
            <h2 className="text-title font-extrabold">Cuatro pasos, sin llamadas</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-sand-700">
              Todo se resuelve desde una pantalla, a cualquier hora. Estas son las cuatro cosas que vas a hacer.
            </p>
          </div>

          <ol className="mt-12 lg:mt-16">
            {PASOS.map(({ n, titulo, texto, Maqueta }, i) => (
              <li
                key={n}
                className={`grid grid-cols-1 items-center gap-x-10 gap-y-6 border-t border-sand-300 lg:grid-cols-12 ${
                  i === PASOS.length - 1 ? 'pb-4' : ''
                } ${i % 2 === 0 ? 'py-10 lg:py-14' : 'py-8 lg:py-12'}`}
              >
                <div className="reveal flex gap-5 lg:col-span-5">
                  <span
                    aria-hidden="true"
                    className="tabular font-display text-[4.5rem] font-extrabold leading-[0.85] tracking-tighter text-primary-500 sm:text-[5.5rem]"
                  >
                    {n}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-2xl font-bold">{titulo}</h3>
                    <p className="mt-2 max-w-sm text-base leading-relaxed text-sand-700">{texto}</p>
                  </div>
                </div>
                <div
                  className={`reveal lg:col-span-6 ${i % 2 === 0 ? 'lg:col-start-7' : 'lg:col-start-6 lg:pr-8'}`}
                  style={{ '--i': 1 }}
                >
                  <div className="max-w-md">
                    <Maqueta />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ───────── Después de reservar ───────── */}
        <section className="container-app py-16 lg:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <h2 className="reveal max-w-xl text-title font-extrabold">Después de reservar, todo queda a mano</h2>
              <dl className="mt-10 max-w-xl divide-y divide-sand-300 border-y border-sand-300">
                {BENEFICIOS.map(([titulo, texto], i) => (
                  <div key={titulo} className="reveal py-5" style={{ '--i': i }}>
                    <dt className="font-display text-lg font-bold text-primary-950">{titulo}</dt>
                    <dd className="mt-1 text-base leading-relaxed text-sand-700">{texto}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="reveal lg:col-span-5 lg:pt-6" style={{ '--i': 2 }}>
              <div className="mx-auto max-w-md lg:max-w-none">
                <MisCitasPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Cierre ───────── */}
        <section className="container-app pb-16 lg:pb-24">
          <div className="surface-dark reveal relative overflow-hidden rounded-[2rem] bg-primary-950 px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
            <AgendaBackdrop bloques={false} />
            <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <h2 className="text-title font-extrabold text-white">Tu próximo turno, a un toque</h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-primary-100">
                  Ingresá con tu email y elegí el horario que mejor te quede.
                </p>
                {whatsapp && (
                  <p className="mt-5 text-base text-primary-200">
                    ¿Preferís escribirnos?{' '}
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-white underline decoration-primary-400 underline-offset-4 transition-colors hover:decoration-accent-300"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      WhatsApp {tenant.phone}
                    </a>
                  </p>
                )}
              </div>
              <div className="lg:col-span-4 lg:justify-self-end">
                <Link to={ingresar} className="btn-accent btn-lg w-full sm:w-auto">
                  Ingresar a mi cuenta
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-300">
        <div className="container-app flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BusinessMark name={tenant.businessName} className="h-9 w-9 text-sm" />
            <span className="font-display text-base font-bold text-primary-950">{tenant.businessName}</span>
          </div>
          <div className="flex flex-col gap-2 text-sm text-sand-600 sm:items-end">
            <span className="flex items-center gap-2">
              Reservas con <LogoMark className="h-5 w-5" /> <span className="font-display font-bold text-primary-950">Agendik</span>
            </span>
            <span>Horarios en zona América/Asunción</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
