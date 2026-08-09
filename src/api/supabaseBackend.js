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

async function fetchTenant() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, business_name, phone')
    .eq('slug', DEFAULT_TENANT)
    .single()
  fail(error, 'No pudimos cargar los datos del negocio.')
  return { id: data.id, slug: data.slug, businessName: data.business_name, phone: data.phone }
}

async function fetchClient(userId) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, tenant_id, user_id, name, email, phone, birth_date, gender, occupation, address, status')
    .eq('user_id', userId)
    .maybeSingle()
  fail(error, 'No pudimos cargar tu perfil.')
  return data ? mapClient(data) : null
}

/** Ficha de equipo. Devuelve null si el usuario es un cliente común. */
async function fetchStaff(userId) {
  const { data, error } = await supabase
    .from('staff')
    .select('id, tenant_id, user_id, name, email, role')
    .eq('user_id', userId)
    .maybeSingle()
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

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    fail(error, 'No pudimos iniciar sesión.')
    const [client, staff, tenant] = await Promise.all([
      fetchClient(data.user.id),
      fetchStaff(data.user.id),
      fetchTenant(),
    ])
    // El equipo del negocio no tiene ficha de cliente: entra por la de staff.
    if (!client && !staff) throw new Error('Tu cuenta todavía no tiene una ficha asociada.')
    if (client && !staff && client.status === 'pending') {
      throw new Error('Tu cuenta está pendiente de aprobación del negocio.')
    }
    return { user: { id: data.user.id, email: data.user.email }, client, staff, tenant }
  },

  async signUp({ name, email, phone, password }) {
    const tenant = await fetchTenant()
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
    const [client, staff, tenant] = await Promise.all([
      fetchClient(data.session.user.id),
      fetchStaff(data.session.user.id),
      fetchTenant(),
    ])
    if (!client && !staff) return null
    return { user: { id: data.session.user.id, email: data.session.user.email }, client, staff, tenant }
  },

  async signOut() {
    await supabase.auth.signOut()
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

  async getProfessionals() {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, tenant_id, name, specialties, slot_interval_min')
      .eq('active', true)
      .order('name')
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

  async createAppointment({ clientId, professionalId, date, startTime, serviceIds, packageId, notes, durationMin, tenantId }) {
    const endTime = addMinutesToTime(startTime, durationMin)

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        professional_id: professionalId,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_min: durationMin,
        package_id: packageId || null,
        status: 'reserved',
        notes: notes || '',
        source: 'portal',
      })
      .select('id')
      .single()

    if (error && /overlap|exclusion|conflict|23P01/i.test(`${error.message} ${error.code}`)) {
      throw new Error('Ese horario acaba de ocuparse. Elegí otro, por favor.')
    }
    fail(error, 'No pudimos crear la cita.')

    const { error: linkError } = await supabase
      .from('appointment_services')
      .insert(serviceIds.map((sid) => ({ appointment_id: data.id, service_id: sid })))
    if (linkError) {
      await supabase.from('appointments').delete().eq('id', data.id)
      fail(linkError, 'No pudimos asociar los servicios a la cita.')
    }

    if (packageId) await supabase.rpc('consume_package_sessions', { p_package_id: packageId, p_service_ids: serviceIds })

    const { data: full, error: readError } = await supabase
      .from('appointments')
      .select(APPT_SELECT)
      .eq('id', data.id)
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
   * Baja de un servicio. Se desactiva en vez de borrarse: las citas
   * históricas lo siguen referenciando y borrarlo rompería el historial.
   */
  async deactivateService(serviceId) {
    const { data, error } = await supabase
      .from('services')
      .update({ active: false })
      .eq('id', serviceId)
      .select('id')
    fail(error, 'No pudimos dar de baja el servicio.')
    if (!data || data.length === 0) throw new Error('No tenés permiso para editar el catálogo.')
    return true
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
