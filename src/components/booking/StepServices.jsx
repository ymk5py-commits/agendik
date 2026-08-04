import { useMemo, useState } from 'react'
import { Check, Layers, Search, Sparkles, X } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '../ui'
import { formatDuration, formatGs } from '../../utils/format'

export default function StepServices({
  services,
  packages,
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
      {/* Paquetes disponibles */}
      {usablePackages.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-sand-900">
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
                  className={`cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 ${
                    selected
                      ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600/20'
                      : 'border-sand-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-sm font-bold text-sand-900">{pkg.name}</p>
                    {selected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {available.map((item) => (
                      <li key={item.serviceId} className="flex justify-between gap-2 text-xs text-sand-600">
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
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs text-primary-900">
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
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400"
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
                className={`shrink-0 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                  category === cat
                    ? 'bg-primary-800 text-white'
                    : 'bg-sand-100 text-sand-600 hover:bg-sand-200'
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
                  aria-label={`${service.name}, ${formatDuration(service.durationMin)}, ${formatGs(service.price)}`}
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                    selected
                      ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600/20'
                      : 'border-sand-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-sand-900">{service.name}</p>
                    <p className="mt-0.5 text-xs text-sand-500">
                      {service.category} · {formatDuration(service.durationMin)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular text-sand-700">{formatGs(service.price)}</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? 'border-primary-700 bg-primary-700 text-white' : 'border-sand-300'
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
