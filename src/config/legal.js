/**
 * Datos legales de Agendik: quién responde por la plataforma y qué versión de las políticas está vigente.
 *
 * Las páginas de Privacidad, Términos y Cookies, sus enlaces, el aviso de cookies y la casilla de aceptación al
 * registrarse se activan SOLAS cuando están completos los campos obligatorios de OPERADOR. Así nunca se publica
 * una política a medias: completá los datos, compilá y desplegá.
 *
 * Ley 4868/2013 (comercio electrónico), art. 7: hay que informar nombre o razón social, domicilio, titulares,
 * correo electrónico y teléfono, en forma permanente, fácil, directa y gratuita.
 */
const DATOS = {
  // Persona física o razón social que responde por Agendik. Obligatorio.
  nombre: '',
  // Solo si es una empresa: nombre de sus titulares (art. 7 de la Ley 4868). Opcional.
  titulares: '',
  // RUC, si tiene. Opcional, pero conviene publicarlo.
  ruc: '',
  // Calle y ciudad. Obligatorio.
  domicilio: '',
  // Teléfono o WhatsApp de contacto. Obligatorio.
  telefono: '',
  // Casilla para consultas de privacidad y pedidos sobre datos personales. Obligatorio.
  // novumholding.lat recibe correo con ImprovMX: este alias tiene que existir ahí (o un comodín) antes de publicar.
  email: 'privacidad@novumholding.lat',
}

/**
 * Solo para revisar cómo se ven las páginas sin publicar nada: `VITE_LEGAL_EJEMPLO=1 npm run dev`.
 * En el build de producción import.meta.env.DEV es false y esto desaparece.
 */
const EJEMPLO = import.meta.env.DEV && import.meta.env.VITE_LEGAL_EJEMPLO === '1'

export const OPERADOR = EJEMPLO
  ? {
      ...DATOS,
      nombre: '[Ejemplo] Nombre del responsable',
      ruc: '[Ejemplo] 1234567-8',
      domicilio: '[Ejemplo] Calle 123, Asunción',
      telefono: '[Ejemplo] +595 981 000 000',
    }
  : DATOS

/** Las tres páginas legales. El texto vive en src/content/legal.jsx y se carga solo al abrir una de ellas. */
export const PAGINAS_LEGALES = [
  { clave: 'privacidad', ruta: '/privacidad', nombre: 'Privacidad' },
  { clave: 'terminos', ruta: '/terminos', nombre: 'Términos' },
  { clave: 'cookies', ruta: '/cookies', nombre: 'Cookies' },
]

/** Cambia cada vez que se modifica el texto de las políticas; se guarda junto a la aceptación de cada cuenta. */
export const VERSION_LEGAL = '2026-10-22'
export const FECHA_LEGAL = '22 de octubre de 2026'

const OBLIGATORIOS = ['nombre', 'domicilio', 'telefono', 'email']

/** true cuando se puede publicar todo lo legal (páginas, enlaces, aviso y casilla de aceptación). */
export const legalListo = OBLIGATORIOS.every((campo) => String(OPERADOR[campo] || '').trim() !== '')

/** Lo que se guarda en la cuenta al aceptar, como prueba de qué versión aceptó y cuándo. */
export function constanciaDeAceptacion() {
  return legalListo ? { acepto_legal: VERSION_LEGAL, acepto_legal_en: new Date().toISOString() } : {}
}
