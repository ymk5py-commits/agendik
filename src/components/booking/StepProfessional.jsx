import { Check, UserSearch } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '../ui'
import { initials } from '../../utils/format'

export default function StepProfessional({
  professionals,
  loading,
  error,
  onRetry,
  selectedCategories,
  selectedProfessionalId,
  onSelect,
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />

  // Solo profesionales que cubren todas las categorías elegidas
  const eligible = (professionals || []).filter((pro) =>
    selectedCategories.every((cat) => pro.specialties.includes(cat)),
  )

  if (eligible.length === 0) {
    return (
      <EmptyState
        icon={UserSearch}
        title="Ningún profesional cubre esa combinación"
        description="Volvé al paso anterior y reservá los servicios por separado."
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {eligible.map((pro) => {
        const selected = selectedProfessionalId === pro.id
        return (
          <button
            key={pro.id}
            type="button"
            onClick={() => onSelect(pro.id)}
            aria-pressed={selected}
            aria-label={`${pro.name}, especialidades: ${pro.specialties.join(', ')}`}
            className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
              selected
                ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600/20'
                : 'border-sand-200 bg-white hover:border-primary-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                selected ? 'bg-primary-800 text-white' : 'bg-sand-200 text-sand-700'
              }`}
            >
              {initials(pro.name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-sand-900">{pro.name}</p>
              <p className="mt-0.5 truncate text-xs text-sand-500">{pro.specialties.join(' · ')}</p>
            </div>

            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? 'border-primary-700 bg-primary-700 text-white' : 'border-sand-300'
              }`}
            >
              {selected && <Check className="h-3.5 w-3.5" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
