import { Check } from 'lucide-react'

export default function StepIndicator({ steps, current, onStepClick }) {
  return (
    <nav aria-label="Progreso de la reserva">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current
          const clickable = done && onStepClick

          return (
            <li key={step} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(index)}
                aria-current={active ? 'step' : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors sm:px-3 ${
                  clickable ? 'cursor-pointer hover:bg-sand-100' : 'cursor-default'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? 'bg-primary-700 text-white'
                      : active
                        ? 'bg-accent-400 text-primary-950'
                        : 'bg-sand-200 text-sand-500'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={`hidden truncate text-sm font-semibold sm:block ${
                    active ? 'text-sand-900' : done ? 'text-primary-700' : 'text-sand-400'
                  }`}
                >
                  {step}
                </span>
              </button>

              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-3 shrink-0 rounded-full sm:w-6 ${done ? 'bg-primary-400' : 'bg-sand-200'}`}
                />
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-2 text-sm font-semibold text-sand-900 sm:hidden">
        Paso {current + 1} de {steps.length} · {steps[current]}
      </p>
    </nav>
  )
}
