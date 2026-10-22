import { forwardRef } from 'react'
import { Link } from 'react-router'

const enlace = 'font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-950'

/**
 * Casilla «Leí y acepto» para los formularios de registro. Los enlaces abren en otra pestaña para no perder lo cargado.
 * Acepta las props de un <input type="checkbox"> (sirve con react-hook-form y con estado controlado).
 */
export const CasillaLegal = forwardRef(function CasillaLegal({ id = 'acepta-legal', error, ...input }, ref) {
  const idError = `${id}-error`
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary-800"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? idError : undefined}
          {...input}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-sand-700">
          Leí y acepto los{' '}
          <Link to="/terminos" target="_blank" rel="noopener" className={enlace}>
            Términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener" className={enlace}>
            Política de privacidad
          </Link>
          .
        </label>
      </div>
      {error && (
        <p id={idError} role="alert" className="mt-1.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
})
