import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Layers, Plus } from 'lucide-react'
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

  const resumen = [
    [stats.upcoming, stats.upcoming === 1 ? 'próxima' : 'próximas'],
    [stats.completed, stats.completed === 1 ? 'completada' : 'completadas'],
    [stats.total, 'en total'],
  ]

  return (
    <div className="space-y-10">
      {/* Saludo + una sola acción principal */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Hola, {firstName}</h1>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base text-sand-700">
            {resumen.map(([n, texto]) => (
              <span key={texto}>
                {appointments.loading ? (
                  <Skeleton className="inline-block h-5 w-20 align-middle" />
                ) : (
                  <>
                    <span className="tabular font-semibold text-primary-950">{n}</span> {texto}
                  </>
                )}
              </span>
            ))}
          </p>
        </div>
        <Link to="/reservar" className="btn-primary btn-lg">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva cita
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Próximas citas */}
        <section aria-labelledby="proximas" className="lg:col-span-7">
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
            <h2 id="proximas" className="font-display text-xl font-bold">Próximas citas</h2>
            <Link
              to="/mis-citas"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm font-semibold text-primary-800 transition-colors hover:text-primary-950"
            >
              Ver todas
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            {appointments.loading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-32" />)
            ) : appointments.error ? (
              <ErrorState message={appointments.error} onRetry={appointments.reload} />
            ) : stats.nextOnes.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No tenés citas agendadas"
                description="Reservá la próxima sin llamar ni esperar respuesta."
                action={
                  <Link to="/reservar" className="btn-primary">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Reservar una cita
                  </Link>
                }
              />
            ) : (
              stats.nextOnes.map((appt) => (
                <AppointmentCard key={appt.id} appointment={appt} onCancel={setToCancel} />
              ))
            )}
          </div>
        </section>

        {/* Paquetes */}
        <section aria-labelledby="paquetes" className="lg:col-span-5">
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
            <h2 id="paquetes" className="font-display text-xl font-bold">Mis paquetes</h2>
            {activePackages.length > 0 && (
              <span className="text-sm text-sand-700">
                {activePackages.length} activo{activePackages.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {packages.loading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-56" />)
            ) : packages.error ? (
              <ErrorState message={packages.error} onRetry={packages.reload} />
            ) : activePackages.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Todavía no tenés paquetes activos"
                description="Cuando contrates un paquete en el local, vas a ver acá cuántas sesiones te quedan."
              />
            ) : (
              activePackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)
            )}
          </div>
        </section>
      </div>

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
