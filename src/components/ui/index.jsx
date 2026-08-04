import { useEffect, useRef } from 'react'
import { Loader2, X } from 'lucide-react'

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
}

export function PageLoader({ label = 'Cargando…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sand-500">
      <Spinner className="h-7 w-7 text-primary-600" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-sand-200/70 ${className}`} />
}

export function Badge({ children, className = '' }) {
  return <span className={`chip ${className}`}>{children}</span>
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-soft">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div>
        <p className="font-display text-base font-semibold text-sand-900">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-sand-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center"
    >
      <p className="text-sm font-medium text-rose-800">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline">
          Reintentar
        </button>
      )}
    </div>
  )
}

/** Modal accesible: cierra con Escape, bloquea scroll y devuelve el foco al abridor */
export function Modal({ open, onClose, title, description, children, footer }) {
  const panelRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = setTimeout(() => panelRef.current?.querySelector('button, input')?.focus(), 40)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      clearTimeout(timer)
      openerRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-lifted animate-slide-up sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-sand-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-sand-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

/** Campo de formulario con label visible, error debajo y ayuda persistente */
export function Field({ label, htmlFor, error, hint, required, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-sand-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}
