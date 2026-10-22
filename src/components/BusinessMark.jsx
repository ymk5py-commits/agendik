/** Iniciales del negocio (hasta dos palabras) para el monograma. */
export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'A'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Monograma del negocio: es la cara de su portal. Agendik queda como firma discreta (ver Logo).
 * `tone="light"` para usarlo sobre superficies oscuras.
 */
export function BusinessMark({ name, tone = 'dark', className = 'h-10 w-10 text-base' }) {
  const light = tone === 'light'
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold tracking-tight ${
        light ? 'bg-white text-primary-900' : 'bg-primary-900 text-accent-300'
      } ${className}`}
    >
      {initials(name)}
    </span>
  )
}
