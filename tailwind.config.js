/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Verde petróleo — color de marca Agendik
        primary: {
          50: '#EEF7F4',
          100: '#D7EDE6',
          200: '#B3DCCF',
          300: '#85C4B0',
          400: '#55A78E',
          500: '#348B72',
          600: '#23705C',
          700: '#1D5A4B',
          800: '#19483D',
          900: '#143830',
          950: '#0B241F',
        },
        // Ámbar mango — acento cálido para CTAs y highlights
        accent: {
          50: '#FFF8EB',
          100: '#FEEECC',
          200: '#FDDD95',
          300: '#FBC75E',
          400: '#F9B03A',
          500: '#F29718',
          600: '#D67908',
          700: '#B25A0A',
          800: '#90460F',
          900: '#763A10',
        },
        // Neutros cálidos (arena) para fondos y bordes
        sand: {
          50: '#FAF9F5',
          100: '#F3F1EA',
          200: '#E7E5DC',
          300: '#D6D3C6',
          400: '#B0AC9C',
          500: '#8A867A',
          600: '#6B6759',
          700: '#57544A',
          800: '#3A3831',
          900: '#26241F',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20, 56, 48, 0.05), 0 4px 16px rgba(20, 56, 48, 0.06)',
        lifted: '0 2px 4px rgba(20, 56, 48, 0.06), 0 12px 32px rgba(20, 56, 48, 0.10)',
        ring: '0 0 0 3px rgba(52, 139, 114, 0.18)',
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
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.28s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
