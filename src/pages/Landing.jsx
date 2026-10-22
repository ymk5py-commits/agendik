import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Clock, MessageCircle, Phone } from 'lucide-react'
import { useTenant } from '../context/TenantContext'
import { useAsync } from '../hooks/useAsync'
import { backend, isDemoMode } from '../api/backend'
import { Logo, LogoMark } from '../components/Logo'
import { BusinessMark } from '../components/BusinessMark'
import { LegalLinks } from '../components/legal/LegalLinks'
import { ErrorState, Skeleton } from '../components/ui'
import { DEMO_CREDENTIALS } from '../data/demoData'
import { formatDuration, formatGs, initials } from '../utils/format'
import { DIAS, ORDEN_SEMANA, ahoraEnAsuncion, estadoDelNegocio } from '../utils/horario'

/*
 * Portal público de un negocio (/n/<slug>): la vidriera, como la ficha de un local en Fresha o Booksy.
 * Todo lo que se ve es real (servicios, equipo y horario salen de catalogo_publico); nada de maquetas ni ejemplos.
 * Reservar pide cuenta: cada «Reservar» lleva al ingreso con el servicio ya elegido.
 */

/** Número de WhatsApp en formato wa.me (solo dígitos); null si el negocio no cargó uno usable. */
function enlaceWhatsApp(telefono) {
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  return digitos.length >= 8 ? `https://wa.me/${digitos}` : null
}

function Estado({ estado, className = '' }) {
  if (!estado) return null
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${estado.abierto ? 'bg-emerald-700' : 'bg-sand-500'}`}
      />
      <span className={estado.abierto ? 'font-medium text-emerald-800' : 'text-sand-700'}>{estado.texto}</span>
    </span>
  )
}

export default function Landing() {
  const { tenant, slug, loading } = useTenant()
  const catalogo = useAsync(() => backend.getCatalogoPublico(slug), [slug], { enabled: Boolean(tenant) })

  useEffect(() => {
    if (!tenant) return undefined
    const anterior = document.title
    document.title = `${tenant.businessName} · Reservas`
    return () => {
      document.title = anterior
    }
  }, [tenant])

  if (loading) return <div className="min-h-dvh bg-sand-50" />

  // El link apunta a un negocio que no existe (o cambió de dirección): mejor decirlo que mostrar un portal vacío.
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

  const servicios = catalogo.data?.servicios ?? []
  const equipo = catalogo.data?.equipo ?? []
  const horarios = catalogo.data?.horarios ?? []
  const cargando = catalogo.loading && !catalogo.data
  const sinServicios = !cargando && !catalogo.error && servicios.length === 0

  const ingresar = `/n/${slug}/ingresar`
  const reservar = (servicioId) => (servicioId ? `${ingresar}?servicio=${encodeURIComponent(servicioId)}` : ingresar)
  const whatsapp = enlaceWhatsApp(tenant.phone)
  const estado = estadoDelNegocio(horarios)

  const secciones = [
    ['servicios', 'Servicios'],
    equipo.length > 0 && ['equipo', 'Equipo'],
    horarios.length > 0 && ['horario', 'Horario'],
  ].filter(Boolean)

  return (
    <div className="min-h-dvh bg-sand-50 pb-24 lg:pb-0">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-primary-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-sand-300 bg-white">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Link to={`/n/${slug}`} className="flex min-h-[44px] min-w-0 items-center gap-3 rounded-lg">
            <BusinessMark name={tenant.businessName} className="h-9 w-9 text-sm" />
            <span className="truncate font-display text-base font-bold text-primary-950">{tenant.businessName}</span>
          </Link>
          <nav aria-label="Cuenta" className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to={ingresar} className="btn-ghost">
              Ingresar
            </Link>
            {!sinServicios && (
              <Link to={reservar()} className="btn-primary hidden sm:inline-flex">
                Reservar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="contenido" className="container-app py-8 lg:py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-8">
            {/* ───────── Ficha del negocio ───────── */}
            <section aria-labelledby="nombre-negocio">
              <h1
                id="nombre-negocio"
                className="min-w-0 text-balance text-display-s font-extrabold [overflow-wrap:anywhere]"
              >
                {tenant.businessName}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
                <Estado estado={estado} />
                {servicios.length > 0 && (
                  <span className="tabular text-sand-700">
                    {servicios.length} {servicios.length === 1 ? 'servicio' : 'servicios'}
                  </span>
                )}
                {tenant.phone && (
                  <a
                    href={whatsapp || `tel:${tenant.phone}`}
                    target={whatsapp ? '_blank' : undefined}
                    rel={whatsapp ? 'noopener noreferrer' : undefined}
                    className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-primary-800 underline-offset-4 hover:underline"
                  >
                    {whatsapp ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
                    <span className="tabular">{tenant.phone}</span>
                  </a>
                )}
              </p>

              {isDemoMode && (
                <p className="mt-5 max-w-md rounded-xl bg-accent-100 px-4 py-3 text-sm text-primary-950">
                  <span className="font-semibold">Modo demo:</span> <span className="tabular">{DEMO_CREDENTIALS.email}</span> ·{' '}
                  <span className="tabular">{DEMO_CREDENTIALS.password}</span>
                </p>
              )}
            </section>

            {/* ───────── Secciones (fija al bajar, como en las fichas de Fresha); con una sola, sobra ───────── */}
            {secciones.length > 1 && (
            <nav
              aria-label="Secciones del negocio"
              className="sticky top-0 z-20 -mx-4 mt-8 border-b border-sand-300 bg-sand-50/95 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
            >
              <ul className="flex gap-6">
                {secciones.map(([id, nombre]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="-mb-px inline-flex min-h-[48px] items-center border-b-2 border-transparent text-base font-medium text-sand-700 transition-colors duration-150 hover:border-primary-600 hover:text-primary-950"
                    >
                      {nombre}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            )}

            <Servicios
              cargando={cargando}
              error={catalogo.error}
              onReintentar={catalogo.reload}
              servicios={servicios}
              reservar={reservar}
              whatsapp={whatsapp}
            />

            {equipo.length > 0 && <Equipo equipo={equipo} />}
            {horarios.length > 0 && <Horario horarios={horarios} />}
          </div>

          {/* ───────── Tarjeta de reserva (escritorio) ───────── */}
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-6 rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <BusinessMark name={tenant.businessName} className="h-11 w-11 text-base" />
                <p className="min-w-0 font-display text-lg font-bold leading-tight text-primary-950">{tenant.businessName}</p>
              </div>
              {estado && <Estado estado={estado} className="mt-4 text-sm" />}

              <div className="mt-6 space-y-3">
                {sinServicios ? (
                  whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg w-full">
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                      Escribir por WhatsApp
                    </a>
                  )
                ) : (
                  <>
                    <Link to={reservar()} className="btn-primary btn-lg w-full">
                      Reservar turno
                    </Link>
                    {whatsapp && (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        WhatsApp
                      </a>
                    )}
                  </>
                )}
              </div>

              <p className="mt-5 text-sm text-sand-700">
                ¿Primera vez?{' '}
                <Link
                  to={`${ingresar}?registro=1`}
                  className="font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-950"
                >
                  Creá tu cuenta
                </Link>{' '}
                con tu email.
              </p>
            </div>
          </aside>
        </div>
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
            <LegalLinks />
          </div>
        </div>
      </footer>

      {/* ───────── Barra fija para reservar (celular) ───────── */}
      {!sinServicios && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white/95 backdrop-blur-sm lg:hidden">
          <div className="container-app flex items-center justify-between gap-4 py-3">
            <p className="min-w-0 text-sm text-sand-700">
              {cargando ? (
                'Cargando servicios…'
              ) : (
                <>
                  <span className="tabular font-semibold text-primary-950">{servicios.length}</span>{' '}
                  {servicios.length === 1 ? 'servicio disponible' : 'servicios disponibles'}
                </>
              )}
            </p>
            <Link to={reservar()} className="btn-primary shrink-0">
              Reservar
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Servicios({ cargando, error, onReintentar, servicios, reservar, whatsapp }) {
  const categorias = useMemo(() => [...new Set(servicios.map((s) => s.category).filter(Boolean))], [servicios])
  const [categoria, setCategoria] = useState(null)
  const visibles = categoria ? servicios.filter((s) => s.category === categoria) : servicios

  return (
    <section id="servicios" aria-labelledby="titulo-servicios" className="scroll-mt-16 pt-8">
      <h2 id="titulo-servicios" className="text-2xl font-bold">
        Servicios
      </h2>

      {categorias.length > 1 && (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div role="group" aria-label="Filtrar por categoría" className="flex w-max gap-2">
            {[null, ...categorias].map((c) => {
              const activa = categoria === c
              return (
                <button
                  key={c ?? 'todas'}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setCategoria(c)}
                  className={`min-h-[44px] cursor-pointer whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-150 ${
                    activa
                      ? 'border-primary-950 bg-primary-950 text-white'
                      : 'border-sand-300 bg-white text-sand-800 hover:border-primary-600'
                  }`}
                >
                  {c ?? 'Todos'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        {error ? (
          <ErrorState message="No pudimos cargar los servicios." onRetry={onReintentar} />
        ) : cargando ? (
          <div className="space-y-px overflow-hidden rounded-2xl border border-sand-200 bg-white" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-5">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="h-11 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        ) : servicios.length === 0 ? (
          <div className="rounded-2xl border border-sand-200 bg-white px-5 py-8 sm:px-8">
            <p className="text-lg font-semibold text-primary-950">Todavía no hay servicios publicados.</p>
            <p className="mt-2 max-w-md text-base text-sand-700">
              {whatsapp
                ? 'El negocio está preparando su agenda en línea. Mientras tanto, podés coordinar tu turno por WhatsApp.'
                : 'El negocio está preparando su agenda en línea. Volvé a mirar en unos días.'}
            </p>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
            {visibles.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-base font-semibold tracking-normal text-primary-950">{s.name}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-sand-700">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDuration(s.durationMin)}
                    {s.capacity > 1 && <span>· Grupal, hasta {s.capacity} personas</span>}
                  </p>
                  <p className="tabular mt-1.5 text-base font-semibold text-sand-900">{formatGs(s.price)}</p>
                </div>
                <Link
                  to={reservar(s.id)}
                  className="btn-outline shrink-0 px-4"
                  aria-label={`Reservar ${s.name}`}
                >
                  Reservar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Equipo({ equipo }) {
  return (
    <section id="equipo" aria-labelledby="titulo-equipo" className="scroll-mt-16 pt-12">
      <h2 id="titulo-equipo" className="text-2xl font-bold">
        Equipo
      </h2>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {equipo.map((p) => (
          <li key={p.id} className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 font-display text-base font-bold text-primary-900"
            >
              {initials(p.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-primary-950">{p.name}</span>
              {p.specialties.length > 0 && (
                <span className="block truncate text-sm text-sand-700">{p.specialties.join(' · ')}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Horario({ horarios }) {
  const porDia = new Map(horarios.map((h) => [h.weekday, h]))
  const hoy = ahoraEnAsuncion().dia

  return (
    <section id="horario" aria-labelledby="titulo-horario" className="scroll-mt-16 pt-12">
      <h2 id="titulo-horario" className="text-2xl font-bold">
        Horario de atención
      </h2>
      <dl className="mt-5 max-w-md divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
        {ORDEN_SEMANA.map((dia) => {
          const h = porDia.get(dia)
          const esHoy = dia === hoy
          return (
            <div key={dia} className={`flex items-center justify-between gap-4 px-5 py-3 ${esHoy ? 'bg-primary-50' : ''}`}>
              <dt className={`text-base ${esHoy ? 'font-semibold text-primary-950' : 'text-sand-800'}`}>
                {DIAS[dia]}
                {esHoy && <span className="ml-2 text-sm font-medium text-primary-700">Hoy</span>}
              </dt>
              <dd className={`tabular text-base ${h ? 'text-sand-900' : 'text-sand-600'} ${esHoy ? 'font-semibold' : ''}`}>
                {h ? `${h.start} a ${h.end}` : 'Cerrado'}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
