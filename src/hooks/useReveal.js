import { useEffect } from 'react'

/**
 * Hace entrar una sola vez, al llegar a la pantalla, a todo lo que tenga la clase `.reveal`
 * (solo opacidad + transform; con «reducir movimiento» el CSS lo deja visible y quieto).
 * `deps` vuelve a engancharlo cuando aparece contenido nuevo (p. ej. al cargar el negocio).
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.is-in)')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
