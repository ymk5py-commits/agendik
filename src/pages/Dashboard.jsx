import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CalendarDays, CheckCheck, Layers, Plus, Sparkles, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import AppointmentCard from '../components/AppointmentCard'
import PackageCard from '../components/PackageCard'
import CancelAppointmentModal from '../components/CancelAppointmentModal'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { byDateTimeAsc, isUpcoming } from '../utils/appointments'

export default function Dashboard() {
  const { client } = useAuth()
  const [toCancel, setToCancel] = useState(null)

  const appointments = useAsync(() => backend.getAppointments(client.id), [client.id], { initialData: [] })
  const packages = useAsync(() => backend.getPackages(client.id), [client.id], { initialData: [] })

  const list = appointments.data || []

  const stats = useMemo(() => {
    const upcoming = list.filter((a) => isUpcoming(a) && ['reserved', 'confirmed'].includes(a.status))
    return {
      upcoming: upcoming.length,
      completed: list.filter((a) => a.status === 'completed').length,
      total: list.filter((a) => a.status !== 'cancelled').length,
      nextOnes: upcoming.sort(byDateTimeAsc).slice(0, 3),
    }
  }, [list])

  const activePackages = (packages.data || []).filter((p) => p.status === 'active')
  const firstName = client?.name?.split(' ')[0] || ''

  const handleCancelled = (updated) => {
    appointments.setData((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    packages.reload()
  }

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <section className="overflow-hidden rounded-2xl bg-primary-950 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent-400">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Tu espacio en Agendik
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-extrabold text-white sm:text-4xl">
              Hola, {firstName}
            </h1>
            <p className="mt-2 max-w-md text-sm text-primary-100">
              Reservá tu próxima cita, revisá tus paquetes y gestioná tu agenda.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/mis-citas" className="btn px-4 py-2.5 text-white ring-1 ring-inset ring-primary-800 hover:bg-primary-900">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Mis citas
            </Link>
            <Link to="/reservar" className="btn-accent">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva cita
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section aria-label="Resumen de tu actividad" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarCheck}
          label="Próximas citas"
          value={stats.upcoming}
          loading={appointments.loading}
          tone="bg-primary-100 text-primary-700"
        />
        <StatCard
          icon={CheckCheck}
          label="Citas completadas"
          value={stats.completed}
          loading={appointments.loading}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={User}
          label="Total de citas"
          value={stats.total}
          loading={appointments.loading}
          tone="bg-accent-100 text-accent-700"
        />
      </section>

      {/* Paquetes */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-sand-900">Mis paquetes</h2>
          {activePackages.length > 0 && (
            <span className="text-sm text-sand-500">
              {activePackages.length} activo{activePackages.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="mt-4">
          {packages.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : packages.error ? (
            <ErrorState message={packages.error} onRetry={packages.reload} />
          ) : activePackages.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Todavía no tenés paquetes activos"
              description="Cuando contrates un paquete en el local, vas a ver acá cuántas sesiones te quedan."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePackages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Próximas citas */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-sand-900">Próximas citas</h2>
          <Link
            to="/mis-citas"
            className="flex items-center gap-1 rounded-lg text-sm font-semibold text-primary-700 transition-colors hover:text-primary-900"
          >
            Ver todas
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {appointments.loading ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-28" />)
          ) : appointments.error ? (
            <ErrorState message={appointments.error} onRetry={appointments.reload} />
          ) : stats.nextOnes.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No tenés citas agendadas"
              description="Reservá tu próxima cita en menos de un minuto."
              action={
                <Link to="/reservar" className="btn-primary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Reservar una cita
                </Link>
              }
            />
          ) : (
            stats.nextOnes.map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} onCancel={setToCancel} compact />
            ))
          )}
        </div>
      </section>

      {toCancel && (
        <CancelAppointmentModal
          appointment={toCancel}
          onClose={() => setToCancel(null)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, loading, tone }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4 sm:p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-sand-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-10" />
        ) : (
          <p className="font-display text-2xl font-extrabold tabular text-sand-900">{value}</p>
        )}
      </div>
    </div>
  )
}
