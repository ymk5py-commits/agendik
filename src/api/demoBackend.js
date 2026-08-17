import { buildDemoSeed } from '../data/demoData'
import { computeDaySlots } from '../data/slots'
import { addMinutesToTime } from '../utils/format'

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

  async signIn({ email, password }) {
    await wait()
    const db = load()
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
      const { userId } = JSON.parse(raw)
      const db = load()
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

  async getServices() {
    await wait(160)
    return load().services
  },

  async getProfessionals() {
    await wait(160)
    return load().professionals
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

  async getAvailability({ professionalId, dateKey, durationMin }) {
    await wait(200)
    const db = load()
    const pro = db.professionals.find((p) => p.id === professionalId)
    if (!pro) return []
    return computeDaySlots({
      workingHours: db.workingHours.filter((w) => w.professionalId === professionalId),
      appointments: db.appointments.filter((a) => a.professionalId === professionalId),
      dateKey,
      durationMin,
      intervalMin: pro.slotIntervalMin,
    })
  },

  async getMonthAvailability({ professionalId, dateKeys, durationMin }) {
    await wait(220)
    const db = load()
    const pro = db.professionals.find((p) => p.id === professionalId)
    if (!pro) return {}
    const wh = db.workingHours.filter((w) => w.professionalId === professionalId)
    const appts = db.appointments.filter((a) => a.professionalId === professionalId)
    const out = {}
    for (const dateKey of dateKeys) {
      out[dateKey] = computeDaySlots({
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
  async getAgenda() {
    return []
  },

  async getAdminClients() {
    return []
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
