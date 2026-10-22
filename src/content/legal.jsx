/**
 * Texto de las políticas de Agendik. La página que las muestra es src/pages/Legal.jsx.
 *
 * Marco: Ley 7593/2025 de Protección de Datos Personales (vigencia plena en noviembre de 2027), Ley 4868/2013 de
 * Comercio Electrónico, Ley 1334/1998 de Defensa del Consumidor y del Usuario y art. 135 de la Constitución
 * (hábeas data). Al cambiar algo importante del texto, actualizá VERSION_LEGAL y FECHA_LEGAL en src/config/legal.js.
 *
 * Redactado como base de trabajo: conviene que lo revise una abogada o un abogado antes de darlo por definitivo.
 */
import { Link } from 'react-router'
import { OPERADOR } from '../config/legal'

const correo = <a href={`mailto:${OPERADOR.email}`}>{OPERADOR.email}</a>

/** Identificación del responsable, como pide el art. 7 de la Ley 4868/2013. */
function DatosDelResponsable() {
  const filas = [
    ['Responsable', OPERADOR.nombre],
    ['Titulares', OPERADOR.titulares],
    ['RUC', OPERADOR.ruc],
    ['Domicilio', OPERADOR.domicilio],
    ['Correo', correo],
    ['Teléfono', OPERADOR.telefono],
  ].filter(([, valor]) => valor)

  return (
    <dl className="legal-datos">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

export const DOCUMENTOS = {
  privacidad: {
    titulo: 'Política de privacidad',
    resumen: [
      'Usamos tus datos para que puedas reservar y para que el negocio pueda atenderte.',
      'No vendemos datos, no mostramos publicidad y no te seguimos por otros sitios.',
      'Podés ver, corregir, descargar o pedir que borremos tus datos cuando quieras.',
    ],
    secciones: [
      {
        id: 'responsable',
        titulo: 'Quién es responsable de tus datos',
        cuerpo: (
          <>
            <p>
              Agendik es una plataforma para que los negocios (centros de estética, consultorios, estudios y similares)
              organicen su agenda y para que sus clientes reserven en línea. La opera:
            </p>
            <DatosDelResponsable />
            <p>Según quién seas, el responsable de tus datos cambia:</p>
            <ul>
              <li>
                <strong>Si sos cliente de un negocio:</strong> el responsable de tu ficha, tus citas y lo que escribas en
                ellas es ese negocio. Agendik trata esos datos por cuenta del negocio y siguiendo sus instrucciones, como
                encargado del tratamiento (Ley 7593/2025).
              </li>
              <li>
                <strong>Si administrás un negocio o formás parte de su equipo:</strong> Agendik es responsable de los datos
                de tu cuenta y del uso que hagas de la plataforma.
              </li>
            </ul>
            <p>
              Podés escribirnos a {correo} por cualquier pedido sobre tus datos, aunque el responsable sea el negocio: lo
              resolvemos o se lo derivamos y te avisamos.
            </p>
          </>
        ),
      },
      {
        id: 'datos',
        titulo: 'Qué datos tratamos',
        cuerpo: (
          <>
            <ul>
              <li>
                <strong>Tu cuenta:</strong> nombre, correo electrónico, teléfono y contraseña. La contraseña se guarda
                transformada (hash): nadie puede leerla, ni siquiera nosotros.
              </li>
              <li>
                <strong>Tu perfil, si decidís completarlo:</strong> fecha de nacimiento, género, ocupación y dirección. Son
                opcionales.
              </li>
              <li>
                <strong>Tus citas:</strong> servicios, profesional, fecha, horario, estado, las notas que escribas, y los
                paquetes o planes que uses.
              </li>
              <li>
                <strong>Los negocios:</strong> nombre, enlace del portal, teléfono, servicios, precios, equipo y horarios,
                además del nombre y el correo de quienes los administran.
              </li>
              <li>
                <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de acceso y seguridad que se
                generan al usar el servicio.
              </li>
              <li>
                <strong>Avisos por correo:</strong> a quién se envió cada aviso, el asunto y si se entregó.
              </li>
            </ul>
            <p>No pedimos datos de tarjetas ni de cuentas bancarias.</p>
          </>
        ),
      },
      {
        id: 'sensibles',
        titulo: 'Datos de salud y otros datos sensibles',
        cuerpo: (
          <p>
            Agendik no necesita datos de salud para funcionar. Te pedimos que no los incluyas en las notas de tus citas,
            salvo que sean necesarios para tu atención (por ejemplo, una alergia que el profesional debe conocer). Si los
            escribís, los recibe el negocio que te atiende, que los trata bajo su responsabilidad y con el cuidado
            reforzado que la ley exige para los datos sensibles.
          </p>
        ),
      },
      {
        id: 'finalidades',
        titulo: 'Para qué los usamos y con qué base legal',
        cuerpo: (
          <>
            <p>Cada uso tiene una base legal de las que prevé el art. 5 de la Ley 7593/2025:</p>
            <ul>
              <li>
                <strong>Crear tu cuenta y reservar, reprogramar o cancelar citas.</strong> Base: ejecución del contrato
                (los Términos y condiciones).
              </li>
              <li>
                <strong>Avisarte por correo sobre tus citas y enviarte el enlace para recuperar tu contraseña.</strong> Base:
                ejecución del contrato.
              </li>
              <li>
                <strong>Proteger el servicio:</strong> evitar accesos indebidos, abuso y fraude, y hacer copias de seguridad.
                Base: interés legítimo.
              </li>
              <li>
                <strong>Medir el uso del sitio de forma agregada y sin cookies, para mejorarlo.</strong> Base: interés
                legítimo.
              </li>
              <li>
                <strong>Cumplir obligaciones legales y responder pedidos de autoridades competentes.</strong> Base:
                obligación legal.
              </li>
            </ul>
            <p>
              No usamos tus datos para publicidad, no los vendemos y no tomamos decisiones automatizadas que te produzcan
              efectos jurídicos. Si alguna vez te pedimos consentimiento para algo, va a ser de forma expresa y vas a poder
              retirarlo cuando quieras, con la misma facilidad con que lo diste.
            </p>
          </>
        ),
      },
      {
        id: 'destinatarios',
        titulo: 'Con quién se comparten',
        cuerpo: (
          <>
            <ul>
              <li>
                <strong>El negocio donde reservás,</strong> que ve tu ficha, tus citas y tus notas para atenderte.
              </li>
              <li>
                <strong>Proveedores que nos ayudan a prestar el servicio,</strong> obligados a proteger los datos y a usarlos
                solo para eso: Cloudflare, Inc. (red, seguridad y estadísticas sin cookies; Estados Unidos) y el servicio de
                envío de correo que usemos para los avisos.
              </li>
              <li>
                <strong>Autoridades,</strong> solo cuando una ley o una orden judicial lo exija.
              </li>
            </ul>
            <p>
              Si tocás un botón de WhatsApp, la conversación ocurre en WhatsApp (Meta) y se rige por sus propias políticas.
            </p>
          </>
        ),
      },
      {
        id: 'ubicacion',
        titulo: 'Dónde se guardan',
        cuerpo: (
          <p>
            La base de datos y sus copias de seguridad están en servidores propios, en Paraguay. El tráfico del sitio pasa
            por la red de Cloudflare, que puede procesarlo en otros países, incluido Estados Unidos. Esa transferencia
            internacional se hace con las garantías contractuales que ofrece ese proveedor, como pide el art. 19 de la Ley
            7593/2025.
          </p>
        ),
      },
      {
        id: 'plazos',
        titulo: 'Cuánto tiempo los conservamos',
        cuerpo: (
          <ul>
            <li>
              <strong>Cuenta y citas:</strong> mientras tu cuenta esté activa. Si pedís la baja, los borramos o anonimizamos
              dentro de los 30 días, salvo lo que una ley obligue a conservar.
            </li>
            <li>
              <strong>Registro de avisos por correo:</strong> 30 días.
            </li>
            <li>
              <strong>Copias de seguridad:</strong> cada copia se borra sola a los 14 días.
            </li>
            <li>
              <strong>Registros técnicos de acceso y seguridad:</strong> el tiempo necesario para proteger el servicio.
            </li>
          </ul>
        ),
      },
      {
        id: 'derechos',
        titulo: 'Tus derechos y cómo ejercerlos',
        cuerpo: (
          <>
            <p>
              Por la Ley 7593/2025 y el art. 135 de la Constitución Nacional (hábeas data), tenés derecho a:
            </p>
            <ul>
              <li>saber qué datos tuyos tratamos y para qué (información y acceso);</li>
              <li>corregirlos si están mal o incompletos (rectificación);</li>
              <li>pedir que los borremos (supresión);</li>
              <li>oponerte a que los usemos para algo en particular (oposición);</li>
              <li>recibirlos en un formato que puedas llevar a otro servicio (portabilidad);</li>
              <li>no quedar sujeto a decisiones tomadas solo de forma automatizada.</li>
            </ul>
            <p>
              Desde <strong>Mi perfil</strong> podés corregir tus datos y descargar una copia. Para todo lo demás, escribinos
              a {correo} desde el correo de tu cuenta. Es gratis y respondemos dentro de los 30 días corridos. Si el pedido
              es sobre datos que trata un negocio, lo coordinamos con él.
            </p>
            <p>
              Si no quedás conforme con la respuesta, podés reclamar ante la Agencia Nacional de Protección de Datos
              Personales, cuando esté en funcionamiento, o ante la justicia.
            </p>
          </>
        ),
      },
      {
        id: 'menores',
        titulo: 'Menores de edad',
        cuerpo: (
          <p>
            Para crear una cuenta tenés que tener 18 años o más, o la autorización de tu madre, padre o tutor. Los menores
            de 16 años necesitan siempre su consentimiento previo y expreso (art. 7 de la Ley 7593/2025). Si un negocio
            atiende a menores, la cuenta debe crearla y administrarla la persona adulta responsable.
          </p>
        ),
      },
      {
        id: 'seguridad',
        titulo: 'Cómo protegemos tus datos',
        cuerpo: (
          <p>
            Usamos conexión cifrada (HTTPS), contraseñas guardadas con hash, reglas en la base de datos que impiden que un
            negocio vea los datos de otro, accesos de administración restringidos y copias de seguridad periódicas. Si
            ocurre un incidente de seguridad que afecte tus datos, lo vamos a notificar a la autoridad y a las personas
            afectadas dentro de las 72 horas de conocerlo, como establece la ley.
          </p>
        ),
      },
      {
        id: 'cambios',
        titulo: 'Cambios en esta política',
        cuerpo: (
          <p>
            Si cambiamos algo importante, te avisamos en la aplicación o por correo antes de que entre en vigencia. Arriba
            figura la fecha de la versión vigente.
          </p>
        ),
      },
      {
        id: 'contacto',
        titulo: 'Contacto',
        cuerpo: (
          <>
            <p>Para consultas sobre esta política o sobre tus datos:</p>
            <DatosDelResponsable />
          </>
        ),
      },
    ],
  },

  terminos: {
    titulo: 'Términos y condiciones',
    resumen: [
      'Agendik es la herramienta para reservar; el servicio que reservás lo presta cada negocio.',
      'Hoy usar Agendik es gratis. Si eso cambia, avisamos con 30 días de anticipación.',
      'Si algo no funciona o no estás de acuerdo con algo, escribinos.',
    ],
    secciones: [
      {
        id: 'quienes',
        titulo: 'Quiénes somos',
        cuerpo: (
          <>
            <p>Agendik es un servicio en línea operado por:</p>
            <DatosDelResponsable />
          </>
        ),
      },
      {
        id: 'servicio',
        titulo: 'Qué es Agendik',
        cuerpo: (
          <p>
            Agendik es un software para que los negocios publiquen sus servicios, organicen su agenda y reciban reservas, y
            para que sus clientes reserven, sigan y cancelen sus citas. Agendik no presta los servicios que se reservan:
            cada negocio es el único responsable de sus servicios, precios, horarios, atención, cobros y condiciones de
            cancelación.
          </p>
        ),
      },
      {
        id: 'aceptacion',
        titulo: 'Aceptación',
        cuerpo: (
          <p>
            Al crear una cuenta aceptás estos términos y declarás haber leído la{' '}
            <Link to="/privacidad">Política de privacidad</Link>. Si no estás de acuerdo, no uses el servicio.
          </p>
        ),
      },
      {
        id: 'cuentas',
        titulo: 'Tu cuenta',
        cuerpo: (
          <ul>
            <li>Tenés que tener 18 años o más, o la autorización de tu madre, padre o tutor.</li>
            <li>Los datos que cargues tienen que ser verdaderos y estar al día.</li>
            <li>
              Tu contraseña es personal. Sos responsable de lo que se haga con tu cuenta; si sospechás que alguien entró sin
              permiso, cambiala y avisanos.
            </li>
            <li>Una cuenta de dueño administra un solo negocio.</li>
          </ul>
        ),
      },
      {
        id: 'reservas',
        titulo: 'Reservas',
        cuerpo: (
          <>
            <p>
              Cuando reservás, la cita queda en la agenda del negocio, que puede confirmarla, reprogramarla o cancelarla.
              Podés cancelar desde <strong>Mis citas</strong> mientras el negocio lo permita.
            </p>
            <p>
              Los precios se muestran en guaraníes y son los que informa cada negocio. El cobro, las señas, las demoras y
              las condiciones de cancelación las fija el negocio: ante cualquier reclamo sobre el servicio que recibiste,
              tu interlocutor es el negocio. Si necesitás ayuda para contactarlo, escribinos.
            </p>
          </>
        ),
      },
      {
        id: 'negocios',
        titulo: 'Si administrás un negocio',
        cuerpo: (
          <ul>
            <li>Sos responsable de la información que publicás: servicios, precios, horarios y datos de contacto.</li>
            <li>
              Tenés que contar con una base legal para tratar los datos de tus clientes e informarles cómo los usás (podés
              remitirlos a nuestra Política de privacidad).
            </li>
            <li>Usás los datos de tus clientes solo para atenderlos y no cargás datos de terceros sin autorización.</li>
            <li>Respondés por las personas de tu equipo a las que das acceso al panel.</li>
          </ul>
        ),
      },
      {
        id: 'encargo',
        titulo: 'Acuerdo de tratamiento de datos con los negocios',
        cuerpo: (
          <>
            <p>
              Para los datos de sus clientes, el negocio es responsable del tratamiento y Agendik es su encargado. Esta
              sección es el contrato que exige el art. 11 de la Ley 7593/2025:
            </p>
            <ul>
              <li>
                <strong>Objeto y duración:</strong> Agendik trata los datos de los clientes y del equipo del negocio
                (identificación y contacto, citas, notas, paquetes y planes) solo para prestar el servicio de agenda y
                reservas, mientras la cuenta del negocio esté activa.
              </li>
              <li>
                <strong>Instrucciones:</strong> Agendik actúa según estas condiciones y las instrucciones del negocio, y no
                usa esos datos para fines propios.
              </li>
              <li>
                <strong>Confidencialidad:</strong> quienes tienen acceso a los datos están obligados a mantenerlos en
                reserva, también después de terminada la relación.
              </li>
              <li>
                <strong>Seguridad:</strong> se aplican las medidas descritas en la Política de privacidad.
              </li>
              <li>
                <strong>Subencargados:</strong> el negocio autoriza a Cloudflare, Inc. (red y seguridad) y al proveedor de
                envío de correo. Si sumamos otro, avisamos con anticipación y el negocio puede oponerse dando de baja su
                cuenta.
              </li>
              <li>
                <strong>Derechos de las personas:</strong> Agendik ayuda al negocio a responder los pedidos de acceso,
                rectificación, supresión, oposición y portabilidad de sus clientes.
              </li>
              <li>
                <strong>Incidentes:</strong> si un incidente afecta datos del negocio, Agendik le avisa sin demora para que
                se cumplan los plazos legales de notificación.
              </li>
              <li>
                <strong>Fin del servicio:</strong> al cerrar la cuenta, el negocio puede pedir una copia de sus datos.
                Después se borran dentro de los 30 días, salvo obligación legal de conservarlos.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'precio',
        titulo: 'Precio',
        cuerpo: (
          <p>
            Hoy Agendik es gratuito. Si en el futuro cobramos por algún plan, te vamos a avisar con al menos 30 días de
            anticipación y vas a poder dar de baja tu cuenta, sin costo, antes de que empiece a regir.
          </p>
        ),
      },
      {
        id: 'uso',
        titulo: 'Uso aceptable',
        cuerpo: (
          <>
            <p>No está permitido usar Agendik para:</p>
            <ul>
              <li>actividades ilegales o engañosas;</li>
              <li>enviar mensajes no solicitados o publicidad masiva;</li>
              <li>intentar entrar a cuentas o datos ajenos, o vulnerar o sobrecargar el sistema;</li>
              <li>hacerse pasar por otra persona o por otro negocio;</li>
              <li>publicar contenido ilícito, ofensivo o que infrinja derechos de terceros.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'disponibilidad',
        titulo: 'Disponibilidad y cambios del servicio',
        cuerpo: (
          <p>
            Hacemos lo posible para que Agendik funcione de forma continua, pero puede haber interrupciones por
            mantenimiento o fallas. Podemos mejorar o cambiar funciones; si un cambio afecta de forma importante a los
            negocios, lo avisamos con anticipación.
          </p>
        ),
      },
      {
        id: 'responsabilidad',
        titulo: 'Responsabilidad',
        cuerpo: (
          <p>
            Agendik no responde por los servicios que prestan los negocios ni por los acuerdos entre negocios y clientes.
            En la medida en que la ley lo permita, tampoco responde por daños indirectos ni por interrupciones causadas por
            terceros o fuera de su control. Nada de esto limita los derechos que te reconoce la Ley 1334/1998 de Defensa del
            Consumidor y del Usuario.
          </p>
        ),
      },
      {
        id: 'propiedad',
        titulo: 'Propiedad intelectual',
        cuerpo: (
          <p>
            El software, la marca y el diseño de Agendik pertenecen a su responsable. Cada negocio conserva los derechos
            sobre su nombre, su logo y su información, y autoriza a Agendik a mostrarlos solo para prestar el servicio.
          </p>
        ),
      },
      {
        id: 'baja',
        titulo: 'Baja y suspensión',
        cuerpo: (
          <p>
            Podés dar de baja tu cuenta cuando quieras, escribiendo a {correo}. Podemos suspender una cuenta que incumpla
            estos términos o ponga en riesgo a otras personas; en ese caso te informamos el motivo, salvo que la ley lo
            impida.
          </p>
        ),
      },
      {
        id: 'modificaciones',
        titulo: 'Cambios en estos términos',
        cuerpo: (
          <p>
            Avisamos los cambios importantes con al menos 15 días de anticipación, en la aplicación o por correo. Si seguís
            usando Agendik después de esa fecha, se entiende que los aceptás; si no estás de acuerdo, podés dar de baja tu
            cuenta.
          </p>
        ),
      },
      {
        id: 'ley',
        titulo: 'Ley aplicable y reclamos',
        cuerpo: (
          <>
            <p>
              Estos términos se rigen por las leyes de la República del Paraguay, en particular la Ley 4868/2013 de Comercio
              Electrónico y la Ley 1334/1998 de Defensa del Consumidor y del Usuario.
            </p>
            <p>
              Ante cualquier problema, escribinos primero a {correo}. También podés reclamar ante la Secretaría de Defensa
              del Consumidor y el Usuario (SEDECO), autoridad de aplicación de esa ley:{' '}
              <a href="https://www.sedeco.gov.py" target="_blank" rel="noopener noreferrer">
                sedeco.gov.py
              </a>{' '}
              o <a href="mailto:info@sedeco.gov.py">info@sedeco.gov.py</a>.
            </p>
          </>
        ),
      },
      {
        id: 'contacto',
        titulo: 'Contacto',
        cuerpo: <DatosDelResponsable />,
      },
    ],
  },

  cookies: {
    titulo: 'Política de cookies',
    resumen: [
      'Solo guardamos en tu navegador lo necesario para que el servicio funcione.',
      'No usamos cookies de publicidad ni de seguimiento.',
      'Las estadísticas de visitas son anónimas y no usan cookies.',
    ],
    secciones: [
      {
        id: 'que-son',
        titulo: 'Qué son',
        cuerpo: (
          <p>
            Las cookies y el almacenamiento local son pequeños datos que un sitio guarda en tu navegador para recordar algo,
            por ejemplo, que ya iniciaste sesión.
          </p>
        ),
      },
      {
        id: 'cuales',
        titulo: 'Qué usamos',
        cuerpo: (
          <div className="legal-tabla" role="region" aria-label="Datos que se guardan en tu navegador" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Para qué</th>
                  <th scope="col">Cuánto dura</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>sb-…-auth-token</code>
                    <span>Almacenamiento local</span>
                  </td>
                  <td>Mantener tu sesión iniciada.</td>
                  <td>Hasta que cerrás sesión.</td>
                </tr>
                <tr>
                  <td>
                    <code>agendik:aviso-cookies</code>
                    <span>Almacenamiento local</span>
                  </td>
                  <td>Recordar que ya viste el aviso de cookies.</td>
                  <td>Hasta que borres los datos del navegador.</td>
                </tr>
                <tr>
                  <td>
                    <code>agendik:chunk-recargado</code>
                    <span>Almacenamiento de sesión</span>
                  </td>
                  <td>Evitar recargas en bucle cuando publicamos una versión nueva.</td>
                  <td>Hasta que cerrás la pestaña.</td>
                </tr>
                <tr>
                  <td>
                    <code>__cf_bm</code>
                    <span>Cookie de Cloudflare</span>
                  </td>
                  <td>Distinguir personas de programas automáticos y proteger el sitio. Solo se usa si Cloudflare la necesita.</td>
                  <td>30 minutos.</td>
                </tr>
                <tr>
                  <td>
                    <code>agendik.demo.*</code>
                    <span>Almacenamiento local</span>
                  </td>
                  <td>Solo en la versión de demostración: guardar los datos de prueba en tu navegador.</td>
                  <td>Hasta que borres los datos del navegador.</td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        id: 'estadisticas',
        titulo: 'Estadísticas de visitas',
        cuerpo: (
          <p>
            Contamos las visitas con Cloudflare Web Analytics, que no usa cookies ni guarda datos en tu navegador y no
            identifica a las personas: solo da cifras agregadas, como cuántas veces se abrió una página.
          </p>
        ),
      },
      {
        id: 'que-no',
        titulo: 'Lo que no usamos',
        cuerpo: (
          <p>
            No usamos cookies de publicidad, de redes sociales ni de seguimiento entre sitios. Las tipografías se sirven
            desde nuestro propio servidor, sin pasar por terceros.
          </p>
        ),
      },
      {
        id: 'consentimiento',
        titulo: 'Por qué no te pedimos permiso',
        cuerpo: (
          <p>
            Todo lo anterior es imprescindible para que el servicio funcione o es anónimo, por eso no requiere tu
            consentimiento; igual te lo contamos con un aviso la primera vez que entrás. Si en el futuro sumamos algo que
            sí lo requiera, te lo vamos a pedir antes de usarlo.
          </p>
        ),
      },
      {
        id: 'borrar',
        titulo: 'Cómo borrarlas',
        cuerpo: (
          <p>
            Podés borrarlas desde la configuración de tu navegador. Si borrás la sesión, vas a tener que volver a ingresar.
            Más detalles sobre tus datos en la <Link to="/privacidad">Política de privacidad</Link>.
          </p>
        ),
      },
    ],
  },
}
