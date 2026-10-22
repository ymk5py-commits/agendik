import { useEffect } from 'react'
import { Link, Navigate, NavLink } from 'react-router'
import { Check } from 'lucide-react'
import { Logo } from '../components/Logo'
import { LegalLinks } from '../components/legal/LegalLinks'
import { DOCUMENTOS } from '../content/legal'
import { FECHA_LEGAL, PAGINAS_LEGALES, VERSION_LEGAL, legalListo } from '../config/legal'

const pestana = ({ isActive }) =>
  `inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors duration-150 ${
    isActive ? 'bg-primary-100 text-primary-900' : 'text-sand-700 hover:bg-sand-100 hover:text-sand-900'
  }`

/** Privacidad, Términos y Cookies. Hasta que los datos del responsable estén completos, no se publica ninguna. */
export default function Legal({ documento }) {
  const doc = DOCUMENTOS[documento]

  useEffect(() => {
    if (!doc) return undefined
    const anterior = document.title
    document.title = `${doc.titulo} · Agendik`
    return () => {
      document.title = anterior
    }
  }, [doc])

  if (!legalListo || !doc) return <Navigate to="/" replace />

  return (
    <div className="min-h-dvh bg-sand-50">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-sand-300 bg-white">
        <div className="container-app flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
          <Link to="/" className="flex min-h-[44px] items-center rounded-lg" aria-label="Agendik, ir al inicio">
            <Logo />
          </Link>
          <nav aria-label="Documentos legales">
            <ul className="flex gap-1">
              {PAGINAS_LEGALES.map(({ ruta, nombre }) => (
                <li key={ruta}>
                  <NavLink to={ruta} className={pestana}>
                    {nombre}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="contenido" className="container-app py-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <aside className="hidden lg:col-span-3 lg:block">
            {/* Con 16 secciones (Términos) no entra en pantallas bajas: el índice se desplaza solo. */}
            <nav aria-label="En esta página" className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto pr-2">
              <p className="text-sm font-semibold text-sand-900">En esta página</p>
              <ol className="mt-3 border-l border-sand-300">
                {doc.secciones.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px flex min-h-[44px] items-center border-l border-transparent py-1 pl-4 text-sm leading-snug text-sand-700 transition-colors duration-150 hover:border-primary-600 hover:text-primary-900"
                    >
                      {s.titulo}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 lg:col-span-8 lg:col-start-5">
            <p className="text-sm font-semibold text-primary-700">Información legal</p>
            <h1 className="mt-3 text-display-s font-extrabold">{doc.titulo}</h1>
            <p className="mt-3 text-sm text-sand-600">
              Vigente desde el {FECHA_LEGAL} · Versión {VERSION_LEGAL}
            </p>

            <section aria-labelledby="en-pocas-palabras" className="mt-8 max-w-[68ch] rounded-2xl bg-primary-50 p-6 sm:p-7">
              <h2 id="en-pocas-palabras" className="text-lg font-bold">
                En pocas palabras
              </h2>
              <ul className="mt-4 space-y-3">
                {doc.resumen.map((linea) => (
                  <li key={linea} className="flex gap-3 text-base leading-relaxed text-sand-800">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                    {linea}
                  </li>
                ))}
              </ul>
            </section>

            {doc.secciones.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`titulo-${s.id}`}
                className="mt-12 max-w-[68ch] scroll-mt-8 border-t border-sand-300 pt-8"
              >
                <h2 id={`titulo-${s.id}`} className="flex items-baseline gap-3 text-xl font-bold sm:text-2xl">
                  <span className="tabular text-base font-semibold text-primary-600" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.titulo}
                </h2>
                <div className="legal-prose mt-4">{s.cuerpo}</div>
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t border-sand-300">
        <div className="container-app flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <LegalLinks />
        </div>
      </footer>
    </div>
  )
}
