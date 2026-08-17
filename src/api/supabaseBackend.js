import { supabase, DEFAULT_TENANT } from './supabaseClient'
import { computeDaySlots } from '../data/slots'
import { addMinutesToTime } from '../utils/format'

/** Traduce errores de Supabase a mensajes que el cliente entiende */
function fail(error, fallback) {
  if (!error) return
  const msg = error.message || ''
  if (/invalid login credentials/i.test(msg)) throw new Error('Email o contraseña incorrectos.')
  if (/already registered|already exists/i.test(msg)) throw new Error('Ya existe una cuenta con ese email.')
  if (/email not confirmed/i.test(msg)) throw new Error('Confirmá tu email antes de iniciar sesión.')
  // Pasa cuando el servidor se reinició: el token sigue en el navegador pero
  // la sesión del otro lado ya no existe. El mensaje genérico confundía.
  if (/session_not_found|session from session_id/i.test(msg)) {
    throw new Error('Tu sesión venció. Cerrá sesión y volvé a entrar para hacer este cambio.')
  }
  if (/failed to fetch|network/i.test(msg)) throw new Error('Sin conexión al servidor. Verificá tu internet.')
  throw new Error(fallback || msg || 'Ocurrió un error inesperado.')
}

/**
 * Reintenta una vez cuando la API rechaza el token por venir "del futuro".
 *
 * El contenedor que emite el token y el que lo valida no comparten reloj al
 * milisegundo, y el `iat` tiene granularidad de un segundo. Si el login y la
 * primera consulta caen dentro del mismo segundo, la API puede ver un `iat`
 * mayor que su propio reloj y devolver 401 (PGRST303). Se nota sobre todo en
 * el navegador, que dispara las consultas apenas recibe el token; esperar un
 * instante y repetir lo resuelve.
 */
async function conReintento(consulta) {
  const primera = await consulta()
  const msg = primera.error?.message || ''
  const codigo = primera.error?.code || ''
  if (primera.error && (codigo === 'PGRST303' || /issued at future/i.test(msg))) {
    await new Promise((listo) => setTimeout(listo, 1200))
    return consulta()
  }
  return primera
}

const TENANT_COLS = 'id, slug, business_name, phone'
const mapTenant = (r) => ({ id: r.id, slug: r.slug, businessName: r.business_name, phone: r.phone })

/**
 * El negocio del usuario logueado, según su propia ficha.
 *
 * Antes esto traía siempre el negocio de `VITE_DEFAULT_TENANT`, lo que estaba
 * bien cuando había uno solo: con varios, al dueño de un negocio le aparecía
 * el nombre de otro en el encabezado.
 */
async function fetchTenantById(tenantId) {
  if (!tenantId) return null
  const { data, error } = await conReintento(() =>
    supabase.from('tenants').select(TENANT_COLS).eq('id', tenantId).single(),
  )
  fail(error, 'No pudimos cargar los datos del negocio.')
  return mapTenant(data)
}

async function fetchClient(userId) {
  const { data, error } = await conReintento(() =>
    supabase
      .from('clients')
      .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
      .eq('user_id', userId)
      .maybeSingle(),
  )
  fail(error, 'No pudimos cargar tu perfil.')
  return data ? mapClient(data) : null
}

/**
 * ¿Es el dueño de la plataforma (quien da de alta los negocios)?
 *
 * Un error acá no puede tumbar el login: si la consulta falla, se asume que
 * no lo es, que es la opción segura.
 */
async function fetchIsPlatformAdmin() {
  const { data, error } = await conReintento(() => supabase.rpc('is_platform_admin'))
  if (error) return false
  return data === true
}

/** Ficha de equipo. Devuelve null si el usuario es un cliente común. */
async function fetchStaff(userId) {
  const { data, error } = await conReintento(() =>
    supabase.from('staff').select('id, tenant_id, user_id, name, email, role').eq('user_id', userId).maybeSingle(),
  )
  fail(error, 'No pudimos verificar tus permisos.')
  return data
    ? { id: data.id, tenantId: data.tenant_id, name: data.name, email: data.email, role: data.role }
    : null
}

const mapClient = (r) => ({
  id: r.id,
  tenantId: r.tenant_id,
  userId: r.user_id,
  name: r.name,
  email: r.email,
  phone: r.phone || '',
  birthDate: r.birth_date || '',
  gender: r.gender || '',
  occupation: r.occupation || '',
  address: r.address || '',
  status: r.status,
})

const mapService = (r) => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  category: r.category,
  durationMin: r.duration_min,
  price: Number(r.price),
  active: r.active !== false,
})

const mapPro = (r) => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  specialties: r.specialties || [],
  slotIntervalMin: r.slot_interval_min,
  active: r.active !== false,
})

const mapAppointment = (r) => ({
  id: r.id,
  tenantId: r.tenant_id,
  clientId: r.client_id,
  professionalId: r.professional_id,
  date: r.date,
  startTime: String(r.start_time).slice(0, 5),
  endTime: String(r.end_time).slice(0, 5),
  durationMin: r.duration_min,
  serviceIds: (r.appointment_services || []).map((s) => s.service_id),
  services: (r.appointment_services || []).map((s) => s.services && mapService(s.services)).filter(Boolean),
  professional: r.professionals ? mapPro(r.professionals) : null,
  packageId: r.package_id,
  status: r.status,
  notes: r.notes || '',
  source: r.source,
})

const APPT_SELECT = `
  id, tenant_id, client_id, professional_id, date, start_time, end_time, duration_min,
  package_id, status, notes, source,
  professionals ( id, tenant_id, name, specialties, slot_interval_min ),
  appointment_services ( service_id, services ( id, tenant_id, name, category, duration_min, price ) )
`

export const supabaseBackend = {
  mode: 'supabase',

  /**
   * El negocio de un portal público (/n/<slug>).
   *
   * Devuelve null si el slug no existe, para poder mostrar "no encontramos
   * este negocio" en vez de un error genérico. `tenants` tiene lectura
   * pública justamente para esto: hay que poder resolverlo sin estar logueado.
   */
  async getTenantBySlug(slug) {
    if (!slug) return null
    const { data, error } = await supabase
      .from('tenants')
      .select(TENANT_COLS)
      .eq('slug', slug)
      .maybeSingle()
    if (error) return null
    return data ? mapTenant(data) : null
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    fail(error, 'No pudimos iniciar sesión.')
    const [client, staff, isPlatformAdmin] = await Promise.all([
      fetchClient(data.user.id),
      fetchStaff(data.user.id),
      fetchIsPlatformAdmin(),
    ])
    // El equipo del negocio no tiene ficha de cliente: entra por la de staff.
    if (!client && !staff) throw new Error('Tu cuenta todavía no tiene una ficha asociada.')
    const tenant = await fetchTenantById(staff?.tenantId || client?.tenantId)
    if (client && !staff && client.status === 'pending') {
      throw new Error('Tu cuenta está pendiente de aprobación del negocio.')
    }
    return { user: { id: data.user.id, email: data.user.email }, client, staff, tenant, isPlatformAdmin }
  },

  async signUp({ name, email, phone, password, tenantId }) {
    // El negocio lo define el portal donde se está registrando (/n/<slug>),
    // no una variable de entorno: si no, todos caerían en el mismo.
    const tenant = await fetchTenantById(tenantId)
    if (!tenant) throw new Error('No pudimos identificar el negocio. Volvé a abrir el link que te pasaron.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name, phone, tenant_id: tenant.id } },
    })
    fail(error, 'No pudimos crear tu cuenta.')

    // Si el proyecto no exige confirmación de email, la sesión ya viene activa
    // y podemos crear la ficha de cliente en el acto.
    if (data.session && data.user) {
      // Si el negocio ya te fichó por WhatsApp o mostrador, se adopta esa
      // ficha con tu historial en vez de crear una nueva vacía.
      const { data: adoptada } = await supabase.rpc('claim_client_record')
      if (adoptada) return { message: 'Cuenta creada. Ya podés iniciar sesión.' }

      const { error: insertError } = await supabase.from('clients').insert({
        user_id: data.user.id,
        tenant_id: tenant.id,
        name,
        email: email.trim().toLowerCase(),
        phone,
        status: 'active',
      })
      if (insertError && !/duplicate|unique/i.test(insertError.message)) {
        fail(insertError, 'No pudimos crear tu ficha de cliente.')
      }
      return { message: 'Cuenta creada. Ya podés iniciar sesión.' }
    }
    return { message: 'Cuenta creada. Revisá tu email para confirmarla.' }
  },

  async restoreSession() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return null
    const [client, staff, isPlatformAdmin] = await Promise.all([
      fetchClient(data.session.user.id),
      fetchStaff(data.session.user.id),
      fetchIsPlatformAdmin(),
    ])
    if (!client && !staff) return null
    const tenant = await fetchTenantById(staff?.tenantId || client?.tenantId)
    return {
      user: { id: data.session.user.id, email: data.session.user.email },
      client,
      staff,
      tenant,
      isPlatformAdmin,
    }
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  /**
   * Manda el mail con el link para poner una contraseña nueva.
   *
   * No dice si el email existe o no: responder distinto permitiría averiguar
   * quién tiene cuenta en el negocio. Siempre se contesta lo mismo.
   */
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/recuperar`,
    })
    // Un email inexistente no es un error para el usuario: el mensaje es igual.
    if (error && !/not found|no user/i.test(error.message || '')) {
      if (/rate|limit|seconds/i.test(error.message || '')) {
        throw new Error('Esperá un momento antes de pedir otro mail.')
      }
      fail(error, 'No pudimos enviar el mail. Probá de nuevo en un rato.')
    }
  },

  /**
   * Toma el link del mail y deja la sesión lista para cambiar la contraseña.
   *
   * El cliente se creó con `detectSessionInUrl: false` (para que la app no
   * intente leer la dirección en cada pantalla), así que acá hay que hacerlo a
   * mano. Supabase manda el token de dos formas según la versión: en el
   * fragmento (#access_token=…) o como `?code=…`; se contemplan las dos.
   */
  async startPasswordRecovery() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)

    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) throw new Error('Este link ya venció. Pedí uno nuevo.')
      return true
    }

    const code = query.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw new Error('Este link ya venció. Pedí uno nuevo.')
      return true
    }

    // Sin token en la dirección no se habilita el formulario, aunque haya una
    // sesión abierta: si no, en una computadora compartida bastaría con entrar
    // a /recuperar para cambiarle la contraseña a quien dejó la sesión puesta.
    return false
  },

  /** Guarda la contraseña nueva. Requiere la sesión que dejó el link. */
  async completePasswordReset(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error && /same as the old|should be different/i.test(error.message || '')) {
      throw new Error('Elegí una contraseña distinta a la anterior.')
    }
    fail(error, 'No pudimos cambiar la contraseña.')
  },

  /** Catálogo. El panel pide `todos` para poder ver también los dados de baja. */
  async getServices({ todos = false } = {}) {
    let query = supabase
      .from('services')
      .select('id, tenant_id, name, category, duration_min, price, active')
      .order('category')
      .order('name')
    if (!todos) query = query.eq('active', true)

    const { data, error } = await query
    fail(error, 'No pudimos cargar los servicios.')
    return data.map(mapService)
  },

  /** El panel pide `todos` para poder ver también los dados de baja. */
  async getProfessionals({ todos = false } = {}) {
    let query = supabase
      .from('professionals')
      .select('id, tenant_id, name, specialties, slot_interval_min, active')
      .order('name')
    if (!todos) query = query.eq('active', true)

    const { data, error } = await query
    fail(error, 'No pudimos cargar los profesionales.')
    return data.map(mapPro)
  },

  async getPackages(clientId) {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        id, tenant_id, client_id, name, original_price, discount_percentage, discount_amount,
        final_price, total_paid, remaining_balance, status,
        package_items ( service_id, quantity, sessions_used,
          services ( id, tenant_id, name, category, duration_min, price ) )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    fail(error, 'No pudimos cargar tus paquetes.')
    return data.map((p) => ({
      id: p.id,
      tenantId: p.tenant_id,
      clientId: p.client_id,
      name: p.name,
      originalPrice: Number(p.original_price),
      discountPercentage: Number(p.discount_percentage),
      discountAmount: Number(p.discount_amount),
      finalPrice: Number(p.final_price),
      totalPaid: Number(p.total_paid),
      remainingBalance: Number(p.remaining_balance),
      status: p.status,
      items: (p.package_items || []).map((i) => ({
        serviceId: i.service_id,
        quantity: i.quantity,
        sessionsUsed: i.sessions_used,
        service: i.services ? mapService(i.services) : null,
      })),
    }))
  },

  async getAppointments(clientId) {
    const { data, error } = await supabase
      .from('appointments')
      .select(APPT_SELECT)
      .eq('client_id', clientId)
      .order('date', { ascending: false })
    fail(error, 'No pudimos cargar tus citas.')
    return data.map(mapAppointment)
  },

  async getAvailability({ professionalId, dateKey, durationMin }) {
    const [pro, wh, appts] = await Promise.all([
      supabase.from('professionals').select('slot_interval_min').eq('id', professionalId).single(),
      supabase.from('working_hours').select('weekday, start_time, end_time').eq('professional_id', professionalId),
      supabase
        .from('appointments')
        .select('date, start_time, end_time, status')
        .eq('professional_id', professionalId)
        .eq('date', dateKey)
        .in('status', ['reserved', 'confirmed']),
    ])
    fail(pro.error || wh.error || appts.error, 'No pudimos cargar la disponibilidad.')

    return computeDaySlots({
      workingHours: wh.data.map((w) => ({
        weekday: w.weekday,
        start: String(w.start_time).slice(0, 5),
        end: String(w.end_time).slice(0, 5),
      })),
      appointments: appts.data.map((a) => ({
        date: a.date,
        startTime: String(a.start_time).slice(0, 5),
        endTime: String(a.end_time).slice(0, 5),
        status: a.status,
      })),
      dateKey,
      durationMin,
      intervalMin: pro.data.slot_interval_min,
    })
  },

  async getMonthAvailability({ professionalId, dateKeys, durationMin }) {
    if (dateKeys.length === 0) return {}
    const from = dateKeys[0]
    const to = dateKeys[dateKeys.length - 1]

    const [pro, wh, appts] = await Promise.all([
      supabase.from('professionals').select('slot_interval_min').eq('id', professionalId).single(),
      supabase.from('working_hours').select('weekday, start_time, end_time').eq('professional_id', professionalId),
      supabase
        .from('appointments')
        .select('date, start_time, end_time, status')
        .eq('professional_id', professionalId)
        .gte('date', from)
        .lte('date', to)
        .in('status', ['reserved', 'confirmed']),
    ])
    fail(pro.error || wh.error || appts.error, 'No pudimos cargar la disponibilidad del mes.')

    const workingHours = wh.data.map((w) => ({
      weekday: w.weekday,
      start: String(w.start_time).slice(0, 5),
      end: String(w.end_time).slice(0, 5),
    }))
    const appointments = appts.data.map((a) => ({
      date: a.date,
      startTime: String(a.start_time).slice(0, 5),
      endTime: String(a.end_time).slice(0, 5),
      status: a.status,
    }))

    const out = {}
    for (const dateKey of dateKeys) {
      out[dateKey] = computeDaySlots({
        workingHours,
        appointments,
        dateKey,
        durationMin,
        intervalMin: pro.data.slot_interval_min,
      }).length
    }
    return out
  },

  async createAppointment({ professionalId, date, startTime, serviceIds, packageId, subscriptionId, notes }) {
    // La duración y la hora de fin las calcula el servidor (RPC book_appointment)
    // a partir de los servicios reales: el cliente no puede declarar una duración
    // menor para ocupar menos agenda de la que corresponde.
    const { data: apptId, error } = await supabase.rpc('book_appointment', {
      p_professional_id: professionalId,
      p_date: date,
      p_start_time: startTime,
      p_service_ids: serviceIds,
      p_package_id: packageId || null,
      p_notes: notes || null,
      p_subscription_id: subscriptionId || null,
    })

    if (error && /overlap|exclusion|conflict|23P01/i.test(`${error.message} ${error.code}`)) {
      throw new Error('Ese horario acaba de ocuparse. Elegí otro, por favor.')
    }
    if (error && /turnos de tu plan/i.test(error.message || '')) {
      throw new Error('Ya usaste todos los turnos de tu plan este mes.')
    }
    if (error && /plan no cubre/i.test(error.message || '')) {
      throw new Error('Tu plan no cubre alguno de los servicios elegidos.')
    }
    if (error && /servicio|duración|profesional/i.test(error.message || '')) {
      throw new Error('Revisá los servicios y el profesional elegidos.')
    }
    fail(error, 'No pudimos crear la cita.')

    const { data: full, error: readError } = await supabase
      .from('appointments')
      .select(APPT_SELECT)
      .eq('id', apptId)
      .single()
    fail(readError, 'La cita se creó pero no pudimos leerla.')
    return mapAppointment(full)
  },

  async cancelAppointment(appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .in('status', ['reserved', 'confirmed'])
      .select(APPT_SELECT)
      .maybeSingle()
    fail(error, 'No pudimos cancelar la cita.')
    if (!data) throw new Error('Esa cita ya no se puede cancelar.')
    if (data.package_id) {
      await supabase.rpc('restore_package_sessions', {
        p_package_id: data.package_id,
        p_service_ids: (data.appointment_services || []).map((s) => s.service_id),
      })
    }
    return mapAppointment(data)
  },

  async getAppointmentByToken(token) {
    const { data, error } = await supabase.rpc('get_appointment_by_token', { p_token: token })
    fail(error, 'No pudimos abrir ese link.')
    if (!data || data.length === 0) throw new Error('Link inválido.')
    const row = data[0]
    if (row.expired) throw new Error('Este link venció.')
    return {
      appointment: {
        id: row.appointment_id,
        date: row.date,
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
        status: row.status,
        professional: { name: row.professional_name },
        services: (row.service_names || []).map((name) => ({ name })),
      },
      clientName: row.client_name,
      business: row.business_name,
    }
  },

  /** Confirmar o cancelar desde el link del recordatorio, sin sesión iniciada. */
  async actOnAppointmentByToken(token, action) {
    const { data, error } = await supabase.rpc('act_on_appointment_by_token', {
      p_token: token,
      p_action: action,
    })
    if (error) {
      // Los raise de la función llegan como mensaje: se muestran tal cual.
      throw new Error(error.message.replace(/^.*?:\s*/, '') || 'No pudimos completar la acción.')
    }
    return { status: data }
  },

  async updateProfile(clientId, patch) {
    const { password, ...fields } = patch
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: fields.name,
        phone: fields.phone,
        birth_date: fields.birthDate || null,
        gender: fields.gender || null,
        occupation: fields.occupation || null,
        address: fields.address || null,
      })
      .eq('id', clientId)
      .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
      .single()
    fail(error, 'No pudimos guardar tu perfil.')

    if (password) {
      const { error: pwError } = await supabase.auth.updateUser({ password })
      fail(pwError, 'El perfil se guardó pero no pudimos cambiar la contraseña.')
    }
    return mapClient(data)
  },

  // === Panel del negocio ==============================================
  // Todo lo de acá abajo depende de que el usuario tenga ficha en `staff`.
  // No hace falta comprobarlo en el frontend: si no la tiene, las políticas
  // de Postgres devuelven cero filas.

  /** Agenda del negocio entre dos fechas (yyyy-MM-dd), ya con cliente y servicios. */
  async getAgenda({ from, to } = {}) {
    let query = supabase
      .from('admin_agenda')
      .select('*')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    fail(error, 'No pudimos cargar la agenda.')
    return (data || []).map(mapAgendaRow)
  },

  /** Clientes del negocio, con cuántas citas tiene cada uno. */
  async getAdminClients() {
    const [{ data: clients, error }, { data: appts, error: apptError }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
        .order('name'),
      supabase.from('appointments').select('client_id, status'),
    ])
    fail(error, 'No pudimos cargar los clientes.')
    fail(apptError, 'No pudimos cargar las citas de los clientes.')

    const conteo = new Map()
    for (const a of appts || []) {
      const acc = conteo.get(a.client_id) || { total: 0, activas: 0 }
      acc.total += 1
      if (a.status === 'reserved' || a.status === 'confirmed') acc.activas += 1
      conteo.set(a.client_id, acc)
    }
    return (clients || []).map((c) => ({
      ...mapClient(c),
      appointments: conteo.get(c.id)?.total || 0,
      upcoming: conteo.get(c.id)?.activas || 0,
    }))
  },

  /**
   * Da de alta una ficha de cliente desde el panel.
   *
   * No crea usuario de login a propósito: la mayoría de la gente reserva por
   * WhatsApp y nunca entra a la app. Si esa persona después se registra con
   * el mismo email, adopta esta ficha con todo su historial.
   */
  async createClient({ name, email, phone, birthDate, occupation, address, tenantId }) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        user_id: null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        birth_date: birthDate || null,
        occupation: occupation || null,
        address: address || null,
        status: 'active',
      })
      .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
      .single()
    if (error && /duplicate|unique/i.test(error.message)) {
      throw new Error('Ya existe un cliente con ese email en tu negocio.')
    }
    fail(error, 'No pudimos crear el cliente.')
    return mapClient(data)
  },

  /** Edita una ficha desde el panel. */
  async updateClientAsStaff(clientId, patch) {
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: patch.name,
        phone: patch.phone || null,
        birth_date: patch.birthDate || null,
        occupation: patch.occupation || null,
        address: patch.address || null,
        status: patch.status,
      })
      .eq('id', clientId)
      .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
    fail(error, 'No pudimos guardar el cliente.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar este cliente.')
    return mapClient(data[0])
  },

  // === Plataforma ======================================================
  // Solo para el dueño de la plataforma. Igual que en el resto de la app, el
  // permiso lo decide Postgres: si no lo es, las funciones lo rechazan.

  /** Los negocios dados de alta, con el email de su dueño. */
  async listBusinesses() {
    const { data, error } = await supabase.rpc('list_businesses')
    fail(error, 'No pudimos cargar los negocios.')
    return (data || []).map((b) => ({
      id: b.id,
      slug: b.slug,
      businessName: b.business_name,
      phone: b.phone || '',
      createdAt: b.created_at,
      ownerEmail: b.owner_email || '',
    }))
  },

  /**
   * Da de alta un negocio y la cuenta de su dueño.
   *
   * Devuelve la contraseña temporal para pasársela: no se le envía ningún
   * mail, así que si no se copia en el momento, se pierde (habría que
   * cambiarla desde el panel del negocio).
   */
  async createBusiness({ slug, businessName, phone, ownerEmail, ownerName }) {
    const { data, error } = await supabase.rpc('create_business', {
      p_slug: slug,
      p_business_name: businessName,
      p_phone: phone || null,
      p_owner_email: ownerEmail,
      p_owner_name: ownerName || null,
    })
    if (error) {
      const msg = error.message || ''
      if (/esa dirección/i.test(msg)) throw new Error('Ya hay un negocio con esa dirección web.')
      if (/ese email/i.test(msg)) throw new Error('Ya existe una cuenta con ese email.')
      if (/dirección del negocio/i.test(msg)) {
        throw new Error('La dirección web solo admite minúsculas, números y guiones.')
      }
      if (/dueño de la plataforma/i.test(msg)) {
        throw new Error('No tenés permiso para crear negocios.')
      }
    }
    fail(error, 'No pudimos crear el negocio.')
    return {
      tenantId: data.tenant_id,
      slug: data.slug,
      ownerEmail: data.owner_email,
      ownerPassword: data.owner_password,
    }
  },

  /**
   * Le pone una contraseña nueva a un cliente que perdió la suya.
   *
   * Va por RPC y no por la API de administración porque esa API pide la clave
   * de servicio, que no puede vivir en el navegador. Quién puede hacerlo lo
   * decide la función en Postgres, no esta pantalla.
   */
  async setClientPassword(clientId, password) {
    const { error } = await supabase.rpc('admin_set_client_password', {
      p_client_id: clientId,
      p_password: password,
    })
    if (error) {
      const msg = error.message || ''
      if (/al menos 8/i.test(msg)) throw new Error('La contraseña necesita al menos 8 caracteres.')
      if (/no tiene cuenta/i.test(msg)) {
        throw new Error('Este cliente todavía no tiene cuenta para entrar al portal.')
      }
      if (/equipo/i.test(msg)) {
        throw new Error('No se puede cambiar la contraseña de alguien del equipo desde acá.')
      }
      if (/no es de tu negocio/i.test(msg)) throw new Error('Ese cliente no es de tu negocio.')
    }
    fail(error, 'No pudimos cambiar la contraseña.')
  },

  /**
   * Agenda una cita en nombre de un cliente (teléfono, mostrador, WhatsApp).
   * Si el horario choca, lo rechaza Postgres, no el frontend.
   */
  async createAppointmentForClient({ tenantId, clientId, professionalId, serviceIds, date, startTime, notes }) {
    const { data: servicios, error: svcError } = await supabase
      .from('services')
      .select('id, duration_min')
      .in('id', serviceIds)
    fail(svcError, 'No pudimos leer los servicios elegidos.')

    const duracion = (servicios || []).reduce((acc, s) => acc + s.duration_min, 0)
    if (!duracion) throw new Error('Elegí al menos un servicio.')

    const { data: cita, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        professional_id: professionalId,
        date,
        start_time: startTime,
        end_time: addMinutesToTime(startTime, duracion),
        duration_min: duracion,
        status: 'confirmed',
        source: 'panel',
        notes: notes || null,
      })
      .select('id')
      .single()

    if (error && /appointments_no_overlap|exclusion/i.test(error.message || '')) {
      throw new Error('Ese profesional ya tiene una cita que se superpone con ese horario.')
    }
    fail(error, 'No pudimos crear la cita.')

    const { error: linkError } = await supabase
      .from('appointment_services')
      .insert(serviceIds.map((id) => ({ appointment_id: cita.id, service_id: id })))
    fail(linkError, 'La cita se creó pero no pudimos asociar los servicios.')

    return cita
  },

  /** Alta o edición de un servicio del catálogo. */
  async saveService({ id, tenantId, name, category, durationMin, price, active }) {
    const fila = {
      tenant_id: tenantId,
      name: name.trim(),
      category,
      duration_min: Number(durationMin),
      price: Number(price),
      active: active !== false,
    }
    const query = id
      ? supabase.from('services').update(fila).eq('id', id).select('*')
      : supabase.from('services').insert(fila).select('*')

    const { data, error } = await query
    fail(error, 'No pudimos guardar el servicio.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar el catálogo.')
    return mapService(data[0])
  },

  /**
   * Alta y baja de un servicio. Nunca se borra: las citas históricas lo
   * siguen referenciando y borrarlo rompería el historial. Se desactiva.
   */
  /**
   * Los planes del cliente logueado, con lo que le queda del mes.
   *
   * Lo resuelve la base en una sola consulta (`mis_planes`), que ya calcula el
   * período y los usos: así la pantalla de reserva no tiene que replicar esa
   * lógica ni puede mostrar un número distinto al que va a validar el servidor.
   */
  async getMyPlans() {
    const { data, error } = await supabase.rpc('mis_planes')
    if (error) return []
    return (data || []).map((p) => ({
      id: p.subscription_id,
      planId: p.plan_id,
      name: p.plan_name,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      total: p.total,
      usados: p.usados,
      restantes: p.restantes,
      serviceIds: p.service_ids || [],
    }))
  },

  // === Planes con cuota mensual =======================================

  /** Los planes del negocio, con los servicios que cubre cada uno. */
  async getPlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('id, tenant_id, name, uses_per_period, price, active, plan_services ( service_id )')
      .order('name')
    fail(error, 'No pudimos cargar los planes.')
    return (data || []).map((p) => ({
      id: p.id,
      tenantId: p.tenant_id,
      name: p.name,
      usesPerPeriod: p.uses_per_period,
      price: Number(p.price),
      active: p.active !== false,
      serviceIds: (p.plan_services || []).map((s) => s.service_id),
    }))
  },

  /**
   * Alta o edición de un plan, con los servicios que cubre.
   *
   * Los servicios se reemplazan enteros (se borran y se vuelven a insertar) en
   * vez de calcular altas y bajas: son pocos, y así no quedan estados raros si
   * algo falla en el medio.
   */
  async savePlan({ id, tenantId, name, usesPerPeriod, price, active, serviceIds }) {
    const fila = {
      tenant_id: tenantId,
      name: name.trim(),
      uses_per_period: Number(usesPerPeriod),
      price: Number(price) || 0,
      active: active !== false,
    }
    const { data, error } = await (id
      ? supabase.from('plans').update(fila).eq('id', id).select('id')
      : supabase.from('plans').insert(fila).select('id'))
    fail(error, 'No pudimos guardar el plan.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar los planes.')
    const planId = data[0].id

    await supabase.from('plan_services').delete().eq('plan_id', planId)
    if (serviceIds?.length) {
      const { error: linkError } = await supabase
        .from('plan_services')
        .insert(serviceIds.map((sid) => ({ plan_id: planId, service_id: sid })))
      fail(linkError, 'El plan se guardó pero no pudimos asociar los servicios.')
    }
    return planId
  },

  async setPlanActive(planId, active) {
    const { data, error } = await supabase.from('plans').update({ active }).eq('id', planId).select('id')
    fail(error, 'No pudimos cambiar el estado del plan.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar los planes.')
    return true
  },

  /** Las suscripciones de un cliente, con lo que le queda del período. */
  async getClientSubscriptions(clientId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, plan_id, started_on, status, plans ( name, uses_per_period, price )')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    fail(error, 'No pudimos cargar los planes del cliente.')

    // El detalle de usos se calcula en la base (una consulta por suscripción:
    // son pocas por cliente y así no se duplica la lógica del período acá).
    const conUsos = await Promise.all(
      (data || []).map(async (s) => {
        const { data: u } = await supabase.rpc('usos_de_suscripcion', { p_subscription_id: s.id })
        const uso = Array.isArray(u) ? u[0] : u
        return {
          id: s.id,
          planId: s.plan_id,
          planName: s.plans?.name || '',
          usesPerPeriod: s.plans?.uses_per_period || 0,
          price: Number(s.plans?.price || 0),
          startedOn: s.started_on,
          status: s.status,
          periodStart: uso?.period_start || null,
          periodEnd: uso?.period_end || null,
          usados: uso?.usados ?? 0,
          restantes: uso?.restantes ?? 0,
        }
      }),
    )
    return conUsos
  },

  /** Suscribe a un cliente a un plan. */
  async subscribeClient({ tenantId, clientId, planId, startedOn }) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        plan_id: planId,
        started_on: startedOn || new Date().toISOString().slice(0, 10),
      })
      .select('id')
    fail(error, 'No pudimos asignar el plan.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para asignar planes.')
    return data[0].id
  },

  /** Pausa, reactiva o da de baja una suscripción. */
  async setSubscriptionStatus(subscriptionId, status) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status })
      .eq('id', subscriptionId)
      .select('id')
    fail(error, 'No pudimos cambiar el estado del plan.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar planes.')
    return true
  },

  async setServiceActive(serviceId, active) {
    const { data, error } = await supabase
      .from('services')
      .update({ active })
      .eq('id', serviceId)
      .select('id')
    fail(error, active ? 'No pudimos reactivar el servicio.' : 'No pudimos dar de baja el servicio.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar el catálogo.')
    return true
  },

  /** Alta o edición de un profesional. */
  async saveProfessional({ id, tenantId, name, specialties, slotIntervalMin }) {
    const fila = {
      tenant_id: tenantId,
      name: name.trim(),
      specialties: specialties || [],
      slot_interval_min: Number(slotIntervalMin) || 30,
    }
    const query = id
      ? supabase.from('professionals').update(fila).eq('id', id).select('*')
      : supabase.from('professionals').insert({ ...fila, active: true }).select('*')

    const { data, error } = await query
    fail(error, 'No pudimos guardar el profesional.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar el equipo.')
    return mapPro(data[0])
  },

  /** Baja lógica, por lo mismo que los servicios: hay citas que lo referencian. */
  async setProfessionalActive(professionalId, active) {
    const { data, error } = await supabase
      .from('professionals')
      .update({ active })
      .eq('id', professionalId)
      .select('id')
    fail(error, 'No pudimos cambiar el estado del profesional.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar el equipo.')
    return true
  },

  /** Horarios de atención de un profesional, por día de semana. */
  async getWorkingHours(professionalId) {
    const { data, error } = await supabase
      .from('working_hours')
      .select('id, weekday, start_time, end_time')
      .eq('professional_id', professionalId)
      .order('weekday')
    fail(error, 'No pudimos cargar los horarios.')
    return (data || []).map((w) => ({
      id: w.id,
      weekday: w.weekday,
      start: String(w.start_time).slice(0, 5),
      end: String(w.end_time).slice(0, 5),
    }))
  },

  /**
   * Reemplaza los horarios de un profesional.
   *
   * Se borra todo y se reinserta en vez de hacer diffs: son pocas filas y
   * así no quedan restos si se saca un día. Ojo: cambiar horarios NO toca
   * las citas ya agendadas fuera del nuevo rango; esas quedan y hay que
   * reprogramarlas a mano.
   */
  async saveWorkingHours(professionalId, rangos) {
    const { error: delError } = await supabase
      .from('working_hours')
      .delete()
      .eq('professional_id', professionalId)
    fail(delError, 'No pudimos actualizar los horarios.')

    const filas = rangos
      .filter((r) => r.start && r.end)
      .map((r) => ({
        professional_id: professionalId,
        weekday: r.weekday,
        start_time: r.start,
        end_time: r.end,
      }))

    if (filas.length === 0) return []

    const { data, error } = await supabase.from('working_hours').insert(filas).select('id, weekday, start_time, end_time')
    fail(error, 'No pudimos guardar los horarios.')
    return (data || []).map((w) => ({
      id: w.id,
      weekday: w.weekday,
      start: String(w.start_time).slice(0, 5),
      end: String(w.end_time).slice(0, 5),
    }))
  },

  /**
   * Cuenta propia de quien está en el equipo.
   *
   * Solo el nombre y la contraseña. El rol y el negocio no se pueden tocar
   * ni queriendo: `staff` tiene GRANT de UPDATE únicamente sobre la columna
   * `name`, así que Postgres rechaza el resto por permisos.
   */
  async updateStaffProfile(staffId, { name, password }) {
    const { data, error } = await supabase
      .from('staff')
      .update({ name: name.trim() })
      .eq('id', staffId)
      .select('id, tenant_id, user_id, name, email, role')
    fail(error, 'No pudimos guardar tu cuenta.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar esta cuenta.')

    if (password) {
      const { error: pwError } = await supabase.auth.updateUser({ password })
      fail(pwError, 'La cuenta se guardó pero no pudimos cambiar la contraseña.')
    }

    const r = data[0]
    return { id: r.id, tenantId: r.tenant_id, name: r.name, email: r.email, role: r.role }
  },

  /**
   * Mueve una cita de día, hora o profesional.
   *
   * La duración no cambia (los servicios son los mismos), así que la hora de
   * fin se recalcula sola. Si el destino choca con otra cita del profesional,
   * lo rechaza el índice de exclusión: no hay forma de pisarlo desde acá.
   */
  async rescheduleAppointment(appointmentId, { date, startTime, professionalId, durationMin }) {
    const { data, error } = await supabase
      .from('appointments')
      .update({
        date,
        start_time: startTime,
        end_time: addMinutesToTime(startTime, durationMin),
        professional_id: professionalId,
      })
      .eq('id', appointmentId)
      .select('id, date, start_time, end_time')

    if (error && /appointments_no_overlap|exclusion/i.test(error.message || '')) {
      throw new Error('Ese profesional ya tiene otra cita que se superpone con ese horario.')
    }
    fail(error, 'No pudimos reprogramar la cita.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para mover esta cita.')
    return data[0]
  },

  /**
   * Arma o edita un paquete de sesiones para un cliente.
   *
   * Los importes se calculan acá desde el precio real de cada servicio, no se
   * reciben del formulario: si el catálogo cambia de precio, un paquete nuevo
   * usa el vigente y los viejos conservan el que tenían.
   */
  async savePackage({ id, tenantId, clientId, name, items, discountPercentage, totalPaid }) {
    const serviceIds = items.map((i) => i.serviceId)
    const { data: servicios, error: svcError } = await supabase
      .from('services')
      .select('id, price')
      .in('id', serviceIds)
    fail(svcError, 'No pudimos leer los precios del catálogo.')

    const precio = new Map((servicios || []).map((s) => [s.id, Number(s.price)]))
    const original = items.reduce((acc, i) => acc + (precio.get(i.serviceId) || 0) * i.quantity, 0)
    const descuento = Math.round((original * Number(discountPercentage || 0)) / 100)
    const final = original - descuento
    const pagado = Number(totalPaid || 0)

    const fila = {
      tenant_id: tenantId,
      client_id: clientId,
      name: name.trim(),
      original_price: original,
      discount_percentage: Number(discountPercentage || 0),
      discount_amount: descuento,
      final_price: final,
      total_paid: pagado,
      remaining_balance: final - pagado,
      status: 'active',
    }

    const { data: paquete, error } = id
      ? await supabase.from('packages').update(fila).eq('id', id).select('id').single()
      : await supabase.from('packages').insert(fila).select('id').single()
    fail(error, 'No pudimos guardar el paquete.')

    // Los ítems se reemplazan enteros, pero conservando las sesiones ya usadas
    // de los servicios que siguen: perderlas sería regalarle sesiones al cliente.
    const { data: previos } = await supabase
      .from('package_items')
      .select('service_id, sessions_used')
      .eq('package_id', paquete.id)
    const usadas = new Map((previos || []).map((p) => [p.service_id, p.sessions_used]))

    await supabase.from('package_items').delete().eq('package_id', paquete.id)

    const { error: itemsError } = await supabase.from('package_items').insert(
      items.map((i) => ({
        package_id: paquete.id,
        service_id: i.serviceId,
        quantity: i.quantity,
        sessions_used: Math.min(usadas.get(i.serviceId) || 0, i.quantity),
      })),
    )
    fail(itemsError, 'El paquete se guardó pero no pudimos cargar sus servicios.')

    return paquete
  },

  /** Cierra o cancela un paquete. */
  async setPackageStatus(packageId, status) {
    const { data, error } = await supabase
      .from('packages')
      .update({ status })
      .eq('id', packageId)
      .select('id')
    fail(error, 'No pudimos cambiar el paquete.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar este paquete.')
    return true
  },

  /** Cambia el estado de una cita. La política de Postgres valida el resto. */
  async setAppointmentStatus(appointmentId, status) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId)
      .select('id, status')
    fail(error, 'No pudimos actualizar la cita.')
    // Cero filas significa que RLS lo bloqueó, no que la cita no exista.
    if (!data || data.length === 0) {
      throw new Error('No tenés permiso para modificar esta cita.')
    }
    return data[0]
  },
}

const mapAgendaRow = (r) => ({
  id: r.id,
  date: r.date,
  startTime: (r.start_time || '').slice(0, 5),
  endTime: (r.end_time || '').slice(0, 5),
  durationMin: r.duration_min,
  status: r.status,
  notes: r.notes || '',
  source: r.source,
  clientId: r.client_id,
  clientName: r.client_name,
  clientPhone: r.client_phone || '',
  clientEmail: r.client_email,
  professionalId: r.professional_id,
  professionalName: r.professional_name,
  servicesLabel: r.services_label,
  totalPrice: Number(r.total_price || 0),
})
