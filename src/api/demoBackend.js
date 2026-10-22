import { buildDemoSeed } from '../data/demoData'
import { computeDaySlots, soloHorarios } from '../data/slots'
import { addMinutesToTime } from '../utils/format'

// Cuenta de EQUIPO de ejemplo, solo para recorrer el panel del negocio en modo demo (sin backend). Las acciones que
// escriben siguen sin estar disponibles: el panel real necesita la base.
const DEMO_STAFF_EMAIL = 'equipo@agendik.app'
const demoStaff = (db) => ({
  id: 'st-demo',
  tenantId: db.tenant.id,
  name: 'Rocío Fernández',
  email: DEMO_STAFF_EMAIL,
  role: 'owner',
})

const DB_KEY = 'agendik.demo.db'
const SESSION_KEY = 'agendik.demo.session'

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // JSON corrupto: se regenera desde la semilla
  }
  const seed = buildDemoSeed()
  localStorage.setItem(DB_KEY, JSON.stringify(seed))
  return seed
}

function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

/** Latencia simulada para que los estados de carga se vean como en producción */
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms))

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

export const demoBackend = {
  mode: 'demo',

  async getTenantBySlug() {
    // En demo hay un solo negocio y no hay portales por slug.
    return load().tenant
  },

  async signIn({ email, password }) {
    await wait()
    const db = load()
    if (email.trim().toLowerCase() === DEMO_STAFF_EMAIL && password === 'agendik123') {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ staff: true }))
      return { user: { id: 'u-staff-demo', email: DEMO_STAFF_EMAIL }, client: null, staff: demoStaff(db), tenant: db.tenant }
    }
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || user.password !== password) {
      throw new Error('Email o contraseña incorrectos.')
    }
    const client = db.clients.find((c) => c.userId === user.id)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }))
    // El modo demo no tiene panel de negocio: siempre entra como cliente.
    return { user: { id: user.id, email: user.email }, client, staff: null, tenant: db.tenant }
  },

  async signUp({ name, email, phone, password }) {
    await wait()
    const db = load()
    if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese email.')
    }
    const user = { id: uid('u'), email: email.trim().toLowerCase(), password }
    const client = {
      id: uid('c'),
      userId: user.id,
      tenantId: db.tenant.id,
      name,
      email: user.email,
      phone,
      birthDate: '',
      gender: '',
      occupation: '',
      address: '',
      status: 'active',
    }
    db.users.push(user)
    db.clients.push(client)
    save(db)
    return { message: 'Cuenta creada. Ya podés iniciar sesión.' }
  },

  async restoreSession() {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      const { userId, staff } = JSON.parse(raw)
      const db = load()
      if (staff) {
        return { user: { id: 'u-staff-demo', email: DEMO_STAFF_EMAIL }, client: null, staff: demoStaff(db), tenant: db.tenant }
      }
      const user = db.users.find((u) => u.id === userId)
      if (!user) return null
      const client = db.clients.find((c) => c.userId === user.id)
      return { user: { id: user.id, email: user.email }, client, staff: null, tenant: db.tenant }
    } catch {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY)
  },

  async requestPasswordReset() {
    throw new Error('Recuperar la contraseña necesita conexión a la base.')
  },

  async startPasswordRecovery() {
    return false
  },

  async completePasswordReset() {
    throw new Error('Recuperar la contraseña necesita conexión a la base.')
  },

  async getServices() {
    await wait(160)
    return load().services.map((s) => ({ active: true, capacity: 1, ...s }))
  },

  async getProfessionals() {
    await wait(160)
    return load().professionals.map((p) => ({ active: true, ...p }))
  },

  async getPackages(clientId) {
    await wait(160)
    const db = load()
    return db.packages
      .filter((p) => p.clientId === clientId)
      .map((p) => ({
        ...p,
        items: p.items.map((i) => ({
          ...i,
          service: db.services.find((s) => s.id === i.serviceId) || null,
        })),
      }))
  },

  async getAppointments(clientId) {
    await wait(180)
    const db = load()
    return db.appointments
      .filter((a) => a.clientId === clientId)
      .map((a) => hydrate(db, a))
  },

  async getAvailability({ professionalId, dateKey, durationMin, capacity = 1 }) {
    await wait(200)
    const db = load()
    const pro = db.professionals.find((p) => p.id === professionalId)
    if (!pro) return []
    return soloHorarios(computeDaySlots({
      capacity,
      workingHours: db.workingHours.filter((w) => w.professionalId === professionalId),
      appointments: db.appointments.filter((a) => a.professionalId === professionalId),
      dateKey,
      durationMin,
      intervalMin: pro.slotIntervalMin,
    }))
  },

  async getMonthAvailability({ professionalId, dateKeys, durationMin, capacity = 1 }) {
    await wait(220)
    const db = load()
    const pro = db.professionals.find((p) => p.id === professionalId)
    if (!pro) return {}
    const wh = db.workingHours.filter((w) => w.professionalId === professionalId)
    const appts = db.appointments.filter((a) => a.professionalId === professionalId)
    const out = {}
    for (const dateKey of dateKeys) {
      out[dateKey] = computeDaySlots({
        capacity,
        workingHours: wh,
        appointments: appts,
        dateKey,
        durationMin,
        intervalMin: pro.slotIntervalMin,
      }).length
    }
    return out
  },

  async createAppointment({ clientId, professionalId, date, startTime, serviceIds, packageId, notes, durationMin }) {
    await wait(320)
    const db = load()

    const endTime = addMinutesToTime(startTime, durationMin)
    const clash = db.appointments.some(
      (a) =>
        a.professionalId === professionalId &&
        a.date === date &&
        ['reserved', 'confirmed'].includes(a.status) &&
        startTime < a.endTime &&
        endTime > a.startTime,
    )
    if (clash) throw new Error('Ese horario acaba de ocuparse. Elegí otro, por favor.')

    const appt = {
      id: uid('a'),
      tenantId: db.tenant.id,
      clientId,
      professionalId,
      date,
      startTime,
      endTime,
      durationMin,
      serviceIds,
      packageId: packageId || null,
      status: 'reserved',
      notes: notes || '',
      source: 'portal',
    }
    db.appointments.push(appt)

    if (packageId) {
      const pkg = db.packages.find((p) => p.id === packageId)
      if (pkg) {
        for (const sid of serviceIds) {
          const item = pkg.items.find((i) => i.serviceId === sid)
          if (item && item.sessionsUsed < item.quantity) item.sessionsUsed += 1
        }
        if (pkg.items.every((i) => i.sessionsUsed >= i.quantity)) pkg.status = 'completed'
      }
    }

    save(db)
    return hydrate(db, appt)
  },

  async cancelAppointment(appointmentId) {
    await wait(260)
    const db = load()
    const appt = db.appointments.find((a) => a.id === appointmentId)
    if (!appt) throw new Error('No encontramos esa cita.')
    if (appt.status === 'cancelled') throw new Error('Esa cita ya estaba cancelada.')
    appt.status = 'cancelled'

    if (appt.packageId) {
      const pkg = db.packages.find((p) => p.id === appt.packageId)
      if (pkg) {
        for (const sid of appt.serviceIds) {
          const item = pkg.items.find((i) => i.serviceId === sid)
          if (item && item.sessionsUsed > 0) item.sessionsUsed -= 1
        }
        if (pkg.status === 'completed') pkg.status = 'active'
      }
    }

    save(db)
    return hydrate(db, appt)
  },

  async getAppointmentByToken(token) {
    await wait(240)
    const db = load()
    const entry = db.actionTokens.find((t) => t.token === token)
    if (!entry) throw new Error('Link inválido.')
    if (new Date(entry.expiresAt) < new Date()) throw new Error('Este link venció.')
    const appt = db.appointments.find((a) => a.id === entry.appointmentId)
    if (!appt) throw new Error('Link inválido.')
    const client = db.clients.find((c) => c.id === appt.clientId)
    return { appointment: hydrate(db, appt), clientName: client?.name || '', business: db.tenant.businessName }
  },

  async actOnAppointmentByToken(token, action) {
    await wait(260)
    const db = load()
    const entry = db.actionTokens.find((t) => t.token === token)
    if (!entry) throw new Error('Link inválido.')
    if (new Date(entry.expiresAt) < new Date()) throw new Error('Este link venció.')

    const appt = db.appointments.find((a) => a.id === entry.appointmentId)
    if (!appt) throw new Error('Link inválido.')
    if (!['reserved', 'confirmed'].includes(appt.status)) {
      throw new Error('Esta cita ya no se puede modificar.')
    }

    if (action === 'confirm') {
      appt.status = 'confirmed'
    } else {
      appt.status = 'cancelled'
      // Cancelar devuelve las sesiones de paquete que la cita había consumido.
      const pkg = appt.packageId ? db.packages.find((p) => p.id === appt.packageId) : null
      if (pkg) {
        for (const sid of appt.serviceIds) {
          const item = pkg.items.find((i) => i.serviceId === sid)
          if (item && item.sessionsUsed > 0) item.sessionsUsed -= 1
        }
        if (pkg.status === 'completed') pkg.status = 'active'
      }
    }

    entry.usedAt = new Date().toISOString()
    save(db)
    return { status: appt.status }
  },

  async updateProfile(clientId, patch) {
    await wait(300)
    const db = load()
    const client = db.clients.find((c) => c.id === clientId)
    if (!client) throw new Error('No encontramos tu perfil.')
    const { password, ...fields } = patch
    Object.assign(client, fields)
    if (password) {
      const user = db.users.find((u) => u.id === client.userId)
      if (user) user.password = password
    }
    save(db)
    return client
  },

  async resetDemo() {
    localStorage.removeItem(DB_KEY)
    localStorage.removeItem(SESSION_KEY)
  },

  // El panel del negocio necesita backend real: en modo demo no hay equipo
  // ni datos de otros clientes que mostrar. Se responde vacío en vez de
  // romper, para que la app siga navegable sin Supabase.
  async getAgenda({ from, to } = {}) {
    await wait()
    const db = load()
    const hoy = new Date()
    const dia = (n) => {
      const d = new Date(hoy)
      d.setDate(d.getDate() + n)
      // Fecha local (no UTC): si no, de noche el «hoy» de la demo cae un día corrido.
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const nombre = (id) => db.professionals.find((p) => p.id === id)?.name || 'Por asignar'
    const filas = db.appointments.map((a) => {
      const c = db.clients.find((x) => x.id === a.clientId)
      const servicios = a.serviceIds.map((id) => db.services.find((s) => s.id === id)).filter(Boolean)
      return {
        id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime, durationMin: a.durationMin, status: a.status,
        notes: a.notes || '', source: a.source, clientId: a.clientId, clientName: c?.name || 'Cliente', clientPhone: c?.phone || '',
        clientEmail: c?.email || '', professionalId: a.professionalId, professionalName: nombre(a.professionalId), slotCapacity: 1,
        servicesLabel: servicios.map((s) => s.name).join(' + '), totalPrice: servicios.reduce((n, s) => n + s.price, 0),
      }
    })
    const ejemplo = [
      ['x1', 0, '09:00', '10:00', 'reserved', 'Sofía Ramírez', '+595 983 000 111', 'p1', 'Limpieza Facial Profunda', 180000],
      ['x2', 0, '10:30', '11:30', 'confirmed', 'Paula Acosta', '+595 981 000 222', 'p4', 'Masaje Relajante', 200000],
      ['x3', 0, '15:00', '15:45', 'reserved', 'Marta Vera', '', 'p3', 'Manicura Spa', 90000],
      ['x4', 1, '11:00', '12:30', 'confirmed', 'Julia Benítez', '+595 982 000 333', 'p2', 'Drenaje Linfático', 280000],
      ['x5', 2, '16:00', '17:00', 'cancelled', 'Lucía Montiel', '+595 985 000 444', 'p1', 'Peeling Ultrasónico', 220000],
    ].map(([id, n, startTime, endTime, status, clientName, clientPhone, professionalId, servicesLabel, totalPrice]) => ({
      id, date: dia(n), startTime, endTime, durationMin: 60, status, notes: '', source: 'whatsapp', clientId: `cx-${id}`, clientName,
      clientPhone, clientEmail: '', professionalId, professionalName: nombre(professionalId), slotCapacity: 1, servicesLabel, totalPrice,
    }))
    return [...filas, ...ejemplo]
      .filter((c) => (!from || c.date >= from) && (!to || c.date <= to))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
  },

  async getAdminClients() {
    await wait()
    const db = load()
    const propios = db.clients.map((c) => ({
      ...c,
      appointments: db.appointments.filter((a) => a.clientId === c.id && a.status !== 'cancelled').length,
      upcoming: db.appointments.filter((a) => a.clientId === c.id && ['reserved', 'confirmed'].includes(a.status)).length,
    }))
    const ejemplo = [
      ['Sofía Ramírez', 'sofia@correo.com', '+595 983 000 111', 6, 1, true],
      ['Paula Acosta', 'paula@correo.com', '+595 981 000 222', 3, 1, true],
      ['Marta Vera', 'marta@correo.com', '+595 981 000 333', 1, 1, false],
      ['Julia Benítez', 'julia@correo.com', '+595 982 000 333', 9, 1, true],
    ].map(([name, email, phone, appointments, upcoming, cuenta], i) => ({
      id: `cx-${i}`, tenantId: db.tenant.id, userId: cuenta ? `ux-${i}` : null, name, email, phone, birthDate: '', gender: '',
      occupation: '', address: '', status: 'active', appointments, upcoming,
    }))
    return [...propios, ...ejemplo].sort((a, b) => a.name.localeCompare(b.name))
  },

  async setAppointmentStatus() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async createClient() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async updateClientAsStaff() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setClientPassword() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async listBusinesses() {
    return []
  },

  async createBusiness() {
    throw new Error('Dar de alta negocios necesita conexión a la base.')
  },

  async createAppointmentForClient() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async saveService() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async getMyPlans() {
    return []
  },

  async getPlans() {
    await wait()
    const db = load()
    const ids = db.services.slice(0, 3).map((s) => s.id)
    return [
      { id: 'pl1', tenantId: db.tenant.id, name: 'Plan facial mensual', usesPerPeriod: 4, price: 520000, active: true, serviceIds: ids },
      { id: 'pl2', tenantId: db.tenant.id, name: 'Plan relax', usesPerPeriod: 8, price: 1100000, active: true, serviceIds: ids.slice(1) },
      { id: 'pl3', tenantId: db.tenant.id, name: 'Plan de prueba', usesPerPeriod: 2, price: 200000, active: false, serviceIds: ids.slice(0, 1) },
    ]
  },

  async savePlan() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setPlanActive() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async getClientSubscriptions() {
    return []
  },

  async subscribeClient() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setSubscriptionStatus() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setServiceActive() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async saveProfessional() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setProfessionalActive() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async getWorkingHours() {
    return []
  },

  async saveWorkingHours() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async updateStaffProfile() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async rescheduleAppointment() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async savePackage() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },

  async setPackageStatus() {
    throw new Error('El panel del negocio necesita conexión a la base.')
  },
}

/** Adjunta profesional y servicios a la cita para consumo directo de la UI */
function hydrate(db, appt) {
  return {
    ...appt,
    professional: db.professionals.find((p) => p.id === appt.professionalId) || null,
    services: appt.serviceIds.map((id) => db.services.find((s) => s.id === id)).filter(Boolean),
  }
}
