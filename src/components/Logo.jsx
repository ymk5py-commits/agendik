/** Marca Agendik: calendario con check. `tone` adapta el contraste al fondo. */
export function LogoMark({ tone = 'dark', className = 'h-9 w-9' }) {
  const light = tone === 'light'
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Agendik">
      <rect
        x="4"
        y="8"
        width="56"
        height="52"
        rx="14"
        className={light ? 'fill-white' : 'fill-primary-900'}
      />
      <rect x="14" y="4" width="6" height="12" rx="3" className="fill-accent-500" />
      <rect x="44" y="4" width="6" height="12" rx="3" className="fill-accent-500" />
      <path
        d="M20 36.5 28.5 45 45 27"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={light ? 'stroke-primary-800' : 'stroke-accent-300'}
      />
    </svg>
  )
}

export function Logo({ subtitle, tone = 'dark', className = '' }) {
  const light = tone === 'light'
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark tone={tone} />
      <span className="leading-tight">
        <span
          className={`block font-display text-lg font-extrabold tracking-tight ${
            light ? 'text-white' : 'text-primary-950'
          }`}
        >
          Agendik
        </span>
        {subtitle && (
          <span className={`block text-xs font-medium ${light ? 'text-primary-200' : 'text-sand-500'}`}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
