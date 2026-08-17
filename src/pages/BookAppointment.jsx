import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, CalendarCheck, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import StepIndicator from '../components/booking/StepIndicator'
import StepServices from '../components/booking/StepServices'
import StepProfessional from '../components/booking/StepProfessional'
import StepDateTime from '../components/booking/StepDateTime'
import StepConfirm from '../components/booking/StepConfirm'
import { Spinner } from '../components/ui'
import { formatDuration, formatGs, formatShortDate } from '../utils/format'

const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar']

export default function BookAppointment() {
  const { client, tenant } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [serviceIds, setServiceIds] = useState([])
  const [packageId, setPackageId] = useState(null)
  const [subscriptionId, setSubscriptionId] = useState(null)
  const [professionalId, setProfessionalId] = useState(null)
  const [date, setDate] = useState(null)
  const [time, setTime] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const services = useAsync(() => backend.getServices(), [], { initialData: [] })
  const professionals = useAsync(() => backend.getProfessionals(), [], { initialData: [] })
  const packages = useAsync(() => backend.getPackages(client.id), [client.id], { initialData: [] })
  const plans = useAsync(() => backend.getMyPlans(), [client.id], { initialData: [] })

  const selectedServices = useMemo(
    () => (services.data || []).filter((s) => serviceIds.includes(s.id)),
    [services.data, serviceIds],
  )
  const selectedCategories = useMemo(
    () => Array.from(new Set(selectedServices.map((s) => s.category))),
    [selectedServices],
  )
  const selectedProfessional = (professionals.data || []).find((p) => p.id === professionalId) || null
  const selectedPackage = (packages.data || []).find((p) => p.id === packageId) || null

  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMin, 0)
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0)

  const canContinue = [
    serviceIds.length > 0,
    Boolean(professionalId),
    Boolean(date && time),
    true,
  ][step]

  const toggleService = (id) => {
    setServiceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
      // Cambiar de servicio invalida profesional y horario elegidos
      setProfessionalId(null)
      setDate(null)
      setTime(null)
      return next
    })
  }

  const selectPackage = (id) => {
    setPackageId(id)
    if (id) setSubscriptionId(null)
    if (!id) return
    // Al elegir paquete, dejamos solo los servicios que ese paquete cubre
    const pkg = (packages.data || []).find((p) => p.id === id)
    const covered = new Set(
      (pkg?.items || []).filter((i) => i.sessionsUsed < i.quantity).map((i) => i.serviceId),
    )
    setServiceIds((prev) => prev.filter((sid) => covered.has(sid)))
    setProfessionalId(null)
    setDate(null)
    setTime(null)
  }

  const selectPlan = (id) => {
    setSubscriptionId(id)
    // Plan y paquete son formas distintas de pagar: no se combinan.
    if (id) setPackageId(null)
    if (!id) return
    const plan = (plans.data || []).find((p) => p.id === id)
    const cubiertos = new Set(plan?.serviceIds || [])
    setServiceIds((prev) => prev.filter((sid) => cubiertos.has(sid)))
    setProfessionalId(null)
    setDate(null)
    setTime(null)
  }

  const selectProfessional = (id) => {
    setProfessionalId(id)
    setDate(null)
    setTime(null)
  }

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  // Cada paso arranca desde arriba; si no, el contenido nuevo aparece
  // fuera de pantalla y parece que no pasó nada.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const submit = async () => {
    setSubmitting(true)
    try {
      await backend.createAppointment({
        tenantId: tenant?.id || client.tenantId,
        clientId: client.id,
        professionalId,
        date,
        startTime: time,
        serviceIds,
        packageId,
        subscriptionId,
        notes: notes.trim(),
        durationMin: totalDuration,
      })
      toast.success('¡Cita reservada!')
      navigate('/mis-citas', { replace: true })
    } catch (err) {
      toast.error(err.message)
      // El horario pudo ocuparse mientras confirmaba: vuelve a elegir hora
      if (/ocup/i.test(err.message)) {
        setTime(null)
        setStep(2)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-sand-600 transition-colors hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-sand-900 sm:text-3xl">Nueva cita</h1>
      </div>

      <div className="card">
        <StepIndicator steps={STEPS} current={step} onStepClick={setStep} />
      </div>

      <div className="card animate-fade-in">
        <header className="mb-5">
          <h2 className="font-display text-lg font-bold text-sand-900">{STEP_TITLES[step].title}</h2>
          <p className="mt-0.5 text-sm text-sand-500">{STEP_TITLES[step].hint}</p>
        </header>

        {step === 0 && (
          <StepServices
            services={services.data}
            packages={packages.data}
            plans={plans.data}
            loading={services.loading || packages.loading || plans.loading}
            error={services.error || packages.error}
            onRetry={() => {
              services.reload()
              packages.reload()
              plans.reload()
            }}
            selectedServiceIds={serviceIds}
            selectedPackageId={packageId}
            selectedSubscriptionId={subscriptionId}
            onToggleService={toggleService}
            onSelectPackage={selectPackage}
            onSelectPlan={selectPlan}
          />
        )}

        {step === 1 && (
          <StepProfessional
            professionals={professionals.data}
            loading={professionals.loading}
            error={professionals.error}
            onRetry={professionals.reload}
            selectedCategories={selectedCategories}
            selectedProfessionalId={professionalId}
            onSelect={selectProfessional}
          />
        )}

        {step === 2 && professionalId && (
          <StepDateTime
            professionalId={professionalId}
            durationMin={totalDuration}
            selectedDate={date}
            selectedTime={time}
            onSelectDate={(d) => {
              setDate(d)
              setTime(null)
            }}
            onSelectTime={setTime}
          />
        )}

        {step === 3 && (
          <StepConfirm
            services={selectedServices}
            professional={selectedProfessional}
            date={date}
            time={time}
            pkg={selectedPackage}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}
      </div>

      {/* Barra de acción fija */}
      <div className="sticky bottom-0 -mx-4 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {serviceIds.length > 0 ? (
              <>
                <p className="truncate text-sm font-semibold text-sand-900">
                  {selectedServices.map((s) => s.name).join(' + ')}
                </p>
                <p className="text-xs tabular text-sand-500">
                  {formatDuration(totalDuration)}
                  {subscriptionId
                    ? ' · con tu plan'
                    : packageId
                      ? ' · con tu paquete'
                      : ` · ${formatGs(totalPrice)}`}
                  {date && time ? ` · ${formatShortDate(date)} ${time}` : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-sand-500">Elegí un servicio para empezar</p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            {step > 0 && (
              <button type="button" onClick={goBack} disabled={submitting} className="btn-outline">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Atrás</span>
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={goNext} disabled={!canContinue} className="btn-primary">
                Continuar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="btn-accent">
                {submitting ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {submitting ? 'Reservando…' : 'Confirmar cita'}
              </button>
            )}
          </div>
        </div>
      </div>

      {step === 0 && serviceIds.length === 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-sand-500">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Podés combinar varios servicios en una sola cita
        </p>
      )}
    </div>
  )
}

const STEP_TITLES = [
  { title: '¿Qué te vas a hacer?', hint: 'Elegí uno o más servicios, o usá una sesión de tu paquete.' },
  { title: '¿Quién te atiende?', hint: 'Mostramos solo los profesionales que hacen lo que elegiste.' },
  { title: '¿Cuándo?', hint: 'Los días marcados tienen lugar. Elegí uno y después tu horario.' },
  { title: 'Revisá y confirmá', hint: 'Si algo no cuadra, volvé atrás y cambialo.' },
]
