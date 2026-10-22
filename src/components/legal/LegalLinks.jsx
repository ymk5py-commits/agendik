import { Link } from 'react-router'
import { PAGINAS_LEGALES, legalListo } from '../../config/legal'

/** Enlaces a Privacidad, Términos y Cookies para los pies de página. No muestra nada hasta que lo legal esté completo. */
export function LegalLinks({ tone = 'dark', className = '' }) {
  if (!legalListo) return null
  const color = tone === 'light' ? 'text-primary-200 hover:text-white' : 'text-sand-700 hover:text-primary-800'

  return (
    <nav aria-label="Información legal" className={className}>
      <ul className="flex flex-wrap gap-x-5">
        {PAGINAS_LEGALES.map(({ ruta, nombre }) => (
          <li key={ruta}>
            <Link
              to={ruta}
              className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline ${color}`}
            >
              {nombre}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
