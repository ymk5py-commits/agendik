import { addDays, format, subDays } from 'date-fns'

const key = (d) => format(d, 'yyyy-MM-dd')
const today = new Date()

export const DEMO_CREDENTIALS = { email: 'demo@agendik.app', password: 'agendik123' }

/** Estado inicial del modo demo (se persiste en localStorage) */
export function buildDemoSeed() {
  return {
    tenant: {
      id: 't-demo',
      slug: 'estudio-alma',
      businessName: 'Estudio Alma',
      phone: '+595 981 000 000',
    },
    users: [
      {
        id: 'u-demo',
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      },
    ],
    clients: [
      {
        id: 'c-demo',
        userId: 'u-demo',
        tenantId: 't-demo',
        name: 'Camila Duarte',
        email: DEMO_CREDENTIALS.email,
        phone: '+595 981 234 567',
        birthDate: '1994-03-18',
        gender: 'female',
        occupation: 'Diseñadora',
        address: 'Av. España 1520, Asunción',
        status: 'active',
      },
    ],
    services: [
      { id: 's1', tenantId: 't-demo', name: 'Limpieza Facial Profunda', category: 'Faciales', durationMin: 60, price: 180000 },
      { id: 's2', tenantId: 't-demo', name: 'Peeling Ultrasónico', category: 'Faciales', durationMin: 45, price: 220000 },
      { id: 's3', tenantId: 't-demo', name: 'Masaje Relajante', category: 'Corporales', durationMin: 60, price: 200000 },
      { id: 's4', tenantId: 't-demo', name: 'Drenaje Linfático', category: 'Corporales', durationMin: 90, price: 280000 },
      { id: 's5', tenantId: 't-demo', name: 'Manicura Spa', category: 'Manos & Pies', durationMin: 45, price: 90000 },
      { id: 's6', tenantId: 't-demo', name: 'Pedicura Spa', category: 'Manos & Pies', durationMin: 60, price: 120000 },
      { id: 's7', tenantId: 't-demo', name: 'Corte & Brushing', category: 'Cabello', durationMin: 60, price: 150000 },
      { id: 's8', tenantId: 't-demo', name: 'Coloración Completa', category: 'Cabello', durationMin: 90, price: 450000 },
    ],
    professionals: [
      { id: 'p1', tenantId: 't-demo', name: 'Valeria Núñez', specialties: ['Faciales', 'Corporales'], slotIntervalMin: 30 },
      { id: 'p2', tenantId: 't-demo', name: 'Romina Aguirre', specialties: ['Cabello'], slotIntervalMin: 30 },
      { id: 'p3', tenantId: 't-demo', name: 'Cynthia Torres', specialties: ['Manos & Pies'], slotIntervalMin: 15 },
      { id: 'p4', tenantId: 't-demo', name: 'Lucas Benítez', specialties: ['Corporales', 'Masajes'], slotIntervalMin: 30 },
    ],
    // weekday: 0=domingo ... 6=sábado
    workingHours: [
      ...[1, 2, 3, 4, 5].flatMap((d) => [
        { professionalId: 'p1', weekday: d, start: '08:00', end: '18:00' },
        { professionalId: 'p2', weekday: d, start: '09:00', end: '19:00' },
        { professionalId: 'p3', weekday: d, start: '08:00', end: '17:00' },
        { professionalId: 'p4', weekday: d, start: '10:00', end: '20:00' },
      ]),
      { professionalId: 'p1', weekday: 6, start: '08:00', end: '13:00' },
      { professionalId: 'p2', weekday: 6, start: '08:00', end: '13:00' },
      { professionalId: 'p3', weekday: 6, start: '08:00', end: '13:00' },
    ],
    appointments: [
      {
        id: 'a1', tenantId: 't-demo', clientId: 'c-demo', professionalId: 'p1',
        date: key(addDays(today, 3)), startTime: '10:00', endTime: '11:00', durationMin: 60,
        serviceIds: ['s1'], packageId: 'pk1', status: 'confirmed', notes: '', source: 'portal',
      },
      {
        id: 'a2', tenantId: 't-demo', clientId: 'c-demo', professionalId: 'p3',
        date: key(addDays(today, 8)), startTime: '15:30', endTime: '16:15', durationMin: 45,
        serviceIds: ['s5'], packageId: null, status: 'reserved', notes: 'Esmalte semipermanente', source: 'portal',
      },
      {
        id: 'a3', tenantId: 't-demo', clientId: 'c-demo', professionalId: 'p1',
        date: key(subDays(today, 12)), startTime: '10:00', endTime: '11:00', durationMin: 60,
        serviceIds: ['s1'], packageId: 'pk1', status: 'completed', notes: '', source: 'portal',
      },
      {
        id: 'a4', tenantId: 't-demo', clientId: 'c-demo', professionalId: 'p4',
        date: key(subDays(today, 30)), startTime: '17:00', endTime: '18:00', durationMin: 60,
        serviceIds: ['s3'], packageId: null, status: 'completed', notes: '', source: 'whatsapp',
      },
      {
        id: 'a5', tenantId: 't-demo', clientId: 'c-demo', professionalId: 'p2',
        date: key(subDays(today, 5)), startTime: '11:00', endTime: '12:00', durationMin: 60,
        serviceIds: ['s7'], packageId: null, status: 'cancelled', notes: '', source: 'portal',
      },
    ],
    packages: [
      {
        id: 'pk1', tenantId: 't-demo', clientId: 'c-demo', name: 'Pack Facial Glow',
        items: [
          { serviceId: 's1', quantity: 4, sessionsUsed: 1 },
          { serviceId: 's2', quantity: 2, sessionsUsed: 0 },
        ],
        originalPrice: 1160000, discountPercentage: 15, discountAmount: 174000,
        finalPrice: 986000, totalPaid: 700000, remainingBalance: 286000, status: 'active',
      },
      {
        id: 'pk2', tenantId: 't-demo', clientId: 'c-demo', name: 'Pack Manos Perfectas',
        items: [{ serviceId: 's5', quantity: 3, sessionsUsed: 3 }],
        originalPrice: 270000, discountPercentage: 10, discountAmount: 27000,
        finalPrice: 243000, totalPaid: 243000, remainingBalance: 0, status: 'completed',
      },
    ],
    actionTokens: [
      { token: 'demo', appointmentId: 'a2', expiresAt: key(addDays(today, 30)), usedAt: null },
    ],
  }
}
