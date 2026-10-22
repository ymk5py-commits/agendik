import { useMemo, useState } from 'react'
import { CalendarRange, Check, Layers, Search, Sparkles, X } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '../ui'
import { formatDuration, formatGs } from '../../utils/format'

export default function StepServices({
  services,
  packages,
  plans,
  selectedSubscriptionId,
  onSelectPlan,
  loading,
  error,
  onRetry,
  selectedServiceIds,
  selectedPackageId,
  onToggleService,
  onSelectPackage,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todas')

  const categories = useMemo(
    () => ['todas', ...Array.from(new Set((services || []).map((s) => s.category)))],
    [services],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (services || []).filter((s) => {
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
      const matchesCategory = category === 'todas' || s.category === category
      return matchesQuery && matchesCategory
    })
  }, [services, query, category])

  // Solo se ofrecen los planes que todavía tienen usos este mes: mostrar uno
  // agotado invita a elegirlo para que el servidor lo rechace después.
  const usablePlans = (plans || []).filter((p) => p.restantes > 0)

  const usablePackages = (packages || []).filter(
    (p) => p.status === 'active' && p.items.some((i) => i.sessionsUsed < i.quantity),
  )

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />

  return (
    <div className="space-y-6">
      {/* Planes con cuota mensual */}
      {usablePlans.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-primary-950">
            <CalendarRange className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Usar tu plan del mes
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {usablePlans.map((plan) => {
              const selected = selectedSubscriptionId === plan.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onSelectPlan(selected ? null : plan.id)}
                  aria-pressed={selected}
                  aria-label={`Usar el plan ${plan.name}`}
                  className="option flex-col items-stretch justify-start"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-base font-bold text-primary-950">{plan.name}</p>
                    {selected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-sand-700">
                    Te quedan{' '}
                    <span className="tabular font-bold text-primary-700">
                      {plan.restantes} de {plan.total}
                    </span>{' '}
                    este mes
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Paquetes disponibles */}
      {usablePackages.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-primary-950">
            <Layers className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Usar una sesión de tu paquete
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {usablePackages.map((pkg) => {
              const selected = selectedPackageId === pkg.id
              const available = pkg.items.filter((i) => i.sessionsUsed < i.quantity)
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => onSelectPackage(selected ? null : pkg.id)}
                  aria-pressed={selected}
                  aria-label={`Usar el paquete ${pkg.name}`}
                  className="option flex-col items-stretch justify-start"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-base font-bold text-primary-950">{pkg.name}</p>
                    {selected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {available.map((item) => (
                      <li key={item.serviceId} className="flex justify-between gap-2 text-sm text-sand-700">
                        <span className="truncate">{item.service?.name}</span>
                        <span className="shrink-0 font-semibold tabular text-primary-700">
                          {item.quantity - item.sessionsUsed} restante
                          {item.quantity - item.sessionsUsed > 1 ? 's' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          {selectedPackageId && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Estás usando tu paquete. Elegí abajo qué servicio del paquete querés hacer.
            </p>
          )}
        </section>
      )}

      {/* Catálogo */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-600"
              aria-hidden="true"
            />
            <label htmlFor="buscar-servicio" className="sr-only">
              Buscar servicio
            </label>
            <input
              id="buscar-servicio"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar servicio…"
              className="input pl-10"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`min-h-[44px] shrink-0 cursor-pointer rounded-xl px-4 text-sm font-semibold capitalize transition-colors duration-150 ${
                  category === cat
                    ? 'bg-primary-800 text-white'
                    : 'bg-sand-100 text-sand-800 hover:bg-sand-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No encontramos ese servicio"
              description="Probá con otra palabra o cambiá de categoría."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setCategory('todas')
                  }}
                  className="btn-outline"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            filtered.map((service) => {
              const selected = selectedServiceIds.includes(service.id)
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onToggleService(service.id)}
                  aria-pressed={selected}
                  className="option"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-primary-950">{service.name}</p>
                    <p className="mt-0.5 text-sm text-sand-700">
                      {service.category} · {formatDuration(service.durationMin)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-base font-semibold tabular text-sand-900">{formatGs(service.price)}</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? 'border-primary-700 bg-primary-700 text-white' : 'border-edge'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
