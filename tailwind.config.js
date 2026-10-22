/** @type {import('tailwindcss').Config} */

// Los colores viven como variables CSS en src/styles/index.css (OKLCH, en formato «L C H»).
// Acá se enlazan a Tailwind con `<alpha-value>`, así siguen andando clases como `bg-primary-800/40`.
const color = (name) => `oklch(var(--${name}) / <alpha-value>)`
const escala = (nombre, pasos) => Object.fromEntries(pasos.map((n) => [n, color(`${nombre}-${n}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Blanco tintado hacia la arena: nunca #fff puro (ver DESIGN.md)
        white: color('white'),
        // Verde petróleo: color de marca Agendik
        primary: escala('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        // Ámbar mango: acento cálido, solo para la acción principal y un par de resaltes
        accent: escala('accent', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        // Neutros cálidos (arena): fondos, bordes y texto
        sand: escala('sand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        // Borde de campos y controles: 3:1 contra el fondo (WCAG 1.4.11)
        edge: color('edge'),
        // Estados. `rose` es peligro/error y `emerald` es éxito; `red` es alias de `rose`
        // para que las clases que ya existen queden dentro de la misma escala.
        rose: escala('rose', [50, 100, 200, 300, 500, 600, 700, 800]),
        red: escala('rose', [50, 100, 200, 300, 500, 600, 700, 800]),
        emerald: escala('emerald', [50, 100, 200, 500, 700, 800]),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Escala tipográfica de las páginas de marca (landing, ingreso). El panel usa la escala fija de Tailwind.
      fontSize: {
        display: ['clamp(2.75rem, 1.5rem + 5vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-s': ['clamp(2.25rem, 1.4rem + 3.4vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        title: ['clamp(1.75rem, 1.2rem + 2vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        // Una sola escala: susurro para tarjetas, elevado para lo que flota (menús, modales, maqueta del héroe)
        soft: '0 1px 2px oklch(24% 0.033 178 / 0.05), 0 2px 8px oklch(24% 0.033 178 / 0.04)',
        lifted: '0 2px 4px oklch(24% 0.033 178 / 0.06), 0 16px 40px oklch(24% 0.033 178 / 0.12)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        reveal: {
          '0%': { transform: 'translateY(14px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
      animation: {
        'fade-in': 'fadeIn 220ms var(--ease-out)',
        'slide-up': 'slideUp 300ms var(--ease-out)',
        'slide-in-right': 'slideInRight 280ms var(--ease-out)',
        'scale-in': 'scaleIn 200ms var(--ease-out)',
        reveal: 'reveal 560ms var(--ease-out) both',
      },
    },
  },
  plugins: [],
}
