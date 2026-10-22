import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { VERSION_LEGAL, legalListo } from '../../config/legal'

const CLAVE = 'agendik:aviso-cookies'

function yaLoVio() {
  try {
    return localStorage.getItem(CLAVE) === VERSION_LEGAL
  } catch {
    // Sin acceso al almacenamiento (modo privado estricto): no insistir con el aviso.
    return true
  }
}

/**
 * Aviso informativo, no un pedido de consentimiento: Agendik solo guarda en el navegador lo imprescindible para
 * funcionar (ver /cookies). No bloquea la página ni ofrece «rechazar» porque no hay nada opcional que rechazar.
 * Vuelve a aparecer si cambia la versión de las políticas.
 */
export default function AvisoCookies() {
  const { pathname } = useLocation()
  const [visto, setVisto] = useState(yaLoVio)

  // El portal del negocio y la reserva tienen una barra fija abajo para reservar o avanzar: el aviso no la tapa
  // (se muestra igual en el ingreso, que es por donde pasa todo el que reserva).
  const conBarraFija = pathname.startsWith('/reservar') || /^\/n\/[^/]+\/?$/.test(pathname)
  if (!legalListo || visto || conBarraFija) return null

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, VERSION_LEGAL)
    } catch {
      /* sin almacenamiento: se cierra igual en esta visita */
    }
    setVisto(true)
  }

  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-sand-300 bg-white p-4 shadow-lifted animate-slide-up sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-md sm:p-5"
    >
      <p className="text-sm leading-relaxed text-sand-800">
        <strong className="font-semibold text-primary-950">Solo lo necesario.</strong> Guardamos en tu navegador lo
        imprescindible para que puedas iniciar sesión. Sin publicidad ni seguimiento.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={cerrar} className="btn-primary">
          Entendido
        </button>
        <Link
          to="/cookies"
          className="inline-flex min-h-[44px] items-center whitespace-nowrap text-sm font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-950"
        >
          Ver política de cookies
        </Link>
      </div>
    </section>
  )
}
