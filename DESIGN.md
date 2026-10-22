# Agendik · sistema de diseño

Fuente de verdad: `src/styles/tokens.css` (variables), `tailwind.config.js` (las enlaza a Tailwind) y `src/styles/index.css` (componentes).
No se improvisan colores ni fuentes en los componentes: si falta un valor, se agrega como token.

## Color (OKLCH, formato «L C H»)
| Rol | Token | Uso |
|---|---|---|
| Marca | `primary-50…950` (petróleo, hue ~173) | 800 botón primario, 950 superficie oscura, 600 foco y enlaces, 50/100 fondos suaves |
| Acento | `accent-50…900` (ámbar, hue ~75) | 400 acción principal sobre oscuro; 700 como texto sobre claro; nunca más de ~5 % de una pantalla |
| Papel y texto | `sand-50…900` (arena cálida, hue ~95) | 50 fondo, 200 hairline, 500+ texto secundario (≥ 4.5:1), 800 cuerpo, 900 texto fuerte |
| Borde de control | `edge` | Campos y controles, 3.4:1 contra blanco (WCAG 1.4.11) |
| Blanco | `white` (tintado, 99.4 %) | Tarjetas y campos. Nunca `#fff` |
| Estados | `rose` (peligro), `emerald` (éxito) | Siempre con ícono o texto, nunca solo color |

Contrastes verificados: texto secundario `sand-500` 5.5:1 sobre blanco; `accent-700` 4.9:1; blanco sobre `primary-800` 10.4:1;
texto `primary-950` sobre `accent-400` 8.8:1. `accent-600` y `primary-500` **no** se usan como texto sobre claro.

## Tipografía
> **No cambiar a Inter** (ni a otra fuente "por defecto") sin consultar con Croman: es una regla suya para todos sus proyectos
> (fuentes con carácter, no las genéricas de IA) y Bricolage Grotesque es parte de la identidad de la marca desde el inicio.
> Un cambio a Inter se hizo por fuera de este diseño el 18-oct-2026 a las 17:50 y se revirtió.
- **Display:** Bricolage Grotesque 700–800, tracking −0.025 a −0.035em. Títulos, logotipo, cifras grandes. Nunca cursiva.
- **Cuerpo e interfaz:** Geist 400–600. Cifras tabulares (`.tabular`) en horas, precios y contadores.
- **Carga:** las dos se sirven desde el propio servidor con Fontsource (`src/main.jsx`), no desde Google Fonts: así la IP
  de cada visita no viaja a un tercero (la política de cookies lo afirma). En CSS se llaman «Bricolage Grotesque Variable»
  y «Geist Variable».
- Marca: `text-display` (≤ 5rem), `text-display-s`, `text-title`. Panel: escala fija de Tailwind (sin fluida).
- Cuerpo ≥ 16 px en páginas de marca y en campos; 14 px como mínimo en el panel. Líneas de 65–75 caracteres.

## Forma y profundidad
Radios: 12 px controles, 16 px tarjetas, 24–32 px superficies grandes. Una escala de sombras: `shadow-soft` (tarjetas) y `shadow-lifted`
(lo que flota). Tarjetas con borde de pelo (`sand-200`); no se anidan tarjetas en tarjetas.

## Componentes base (`index.css`)
- `.btn` + `-primary` `-accent` `-outline` `-ghost` `-danger` `-on-dark` `-lg`: 44 px de alto (48 px en `-lg`), hover por color, `active` baja 1 px.
- `.input` 48 px, 16 px de texto, borde 1 px siempre, foco con `outline` de 2 px que aparece **al instante**; `aria-invalid` pinta el borde de peligro.
- `.card`, `.chip`, `.container-app`, `.agenda-grid` (motivo de las superficies oscuras), `.reveal` (entrada una sola vez).
- `Field` (label visible, error debajo, `reserve` deja renglón libre para que el error no empuje la pantalla), `Modal`, `EmptyState`, `Skeleton`.

## Movimiento
Una curva (`--ease-out`, exponencial), tres duraciones (120 / 220 / 420 ms). Solo `transform` y `opacity`. Sin apariciones al hacer scroll:
el contenido está quieto y a la vista. Con «reducir movimiento» se anulan también las transiciones.

## Reglas
- Si alguna vez se usa una superficie oscura, lleva la clase `surface-dark` (foco ámbar) y texto claro.
- Sin cursivas en títulos, sin texto con degradé, sin glassmorphism decorativo, sin `transition-all`.
- Íconos: solo Lucide, trazo uniforme. Sin emojis como íconos.
- Nada de maquetas dibujadas: se muestran capturas reales de la demo, con la leyenda «datos de demostración».

## Referencias del rubro (22-oct-2026)

Se estudiaron Fresha (ficha de local, agenda del negocio, página para negocios) y Cal.com (elección de día y hora).
Se tomó la estructura, no la apariencia: Agendik conserva su paleta y sus fuentes.

- **Portal del negocio (`/n/<slug>`):** ficha de local. Nombre grande, una línea de datos reales (abierto/cerrado
  según el horario, cantidad de servicios, WhatsApp), navegación interna fija, servicios en filas con «Reservar»,
  equipo, horario de la semana con el día de hoy marcado, tarjeta fija para reservar (escritorio) y barra fija (celular).
  Todo sale de `catalogo_publico`: nunca datos de ejemplo en el portal de un negocio real.
- **Agenda del equipo:** vista Día con una columna por profesional y cada cita como bloque de su duración real; el
  detalle se abre al costado (no en una ventana modal). En el celular, lista.
- **Reserva:** horarios agrupados por franja (Mañana / Tarde / Noche).
- **Página de Agendik:** título que dice qué es, capturas reales del producto (de la demo, con leyenda), solo
  afirmaciones verificables. Nada de maquetas dibujadas, eslóganes en dos partes ni grillas de beneficios iguales.
- **Ingreso:** barra del negocio y formulario centrado en una tarjeta; sin panel decorativo ni lista de beneficios.

Las capturas viven en `src/assets/capturas/` (WebP). Si cambia la interfaz, conviene rehacerlas desde la demo.
