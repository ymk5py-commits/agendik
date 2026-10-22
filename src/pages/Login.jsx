import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { ErrorBanner, Field, Spinner } from '../components/ui'
import { Logo, LogoMark } from '../components/Logo'
import { BusinessMark } from '../components/BusinessMark'
import { CasillaLegal } from '../components/legal/CasillaLegal'
import { LegalLinks } from '../components/legal/LegalLinks'
import { legalListo } from '../config/legal'
import { backend, isDemoMode } from '../api/backend'
import { DEMO_CREDENTIALS } from '../data/demoData'

const loginSchema = z.object({
  email: z.string().min(1, 'Ingresá tu email.').email('Ese email no parece válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
})

const registerSchema = z
  .object({
    name: z.string().min(3, 'Escribí tu nombre completo.'),
    email: z.string().min(1, 'Ingresá tu email.').email('Ese email no parece válido.'),
    phone: z.string().min(6, 'Ingresá un teléfono de contacto.'),
    password: z.string().min(8, 'Usá al menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Repetí la contraseña.'),
    // Solo se exige cuando las políticas están publicadas (ver src/config/legal.js).
    acepta: legalListo
      ? z.boolean().refine(Boolean, 'Para crear la cuenta tenés que aceptar los términos y la política de privacidad.')
      : z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

const TABS = [
  { id: 'login', label: 'Ingresar' },
  { id: 'register', label: 'Crear cuenta' },
]

export default function Login() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.has('registro') ? 'register' : 'login')
  const { tenant, slug } = useTenant()
  const inicio = slug ? `/n/${slug}` : '/'

  // Como el ingreso de Fresha o Cal.com: la barra del negocio arriba y el formulario solo, centrado. Sin eslóganes.
  return (
    <div className="flex min-h-dvh flex-col bg-sand-50">
      <header className="border-b border-sand-300 bg-white">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Link to={inicio} className="flex min-h-[44px] min-w-0 items-center gap-3 rounded-lg">
            {tenant ? (
              <>
                <BusinessMark name={tenant.businessName} className="h-9 w-9 text-sm" />
                <span className="truncate font-display text-base font-bold text-primary-950">{tenant.businessName}</span>
              </>
            ) : (
              <Logo />
            )}
          </Link>
          <Link to={inicio} className="btn-ghost shrink-0 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft sm:p-8">
          <div role="tablist" aria-label="Ingresar o crear cuenta" className="mb-7 flex gap-7 border-b border-sand-300">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={`-mb-px min-h-[48px] cursor-pointer border-b-2 px-0.5 text-base font-semibold transition-colors duration-150 ${
                  tab === id
                    ? 'border-primary-800 text-primary-950'
                    : 'border-transparent text-sand-600 hover:text-sand-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'login' ? <LoginForm /> : <RegisterForm onDone={() => setTab('login')} />}
          </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 text-center">
            {tenant && (
              <p className="flex items-center gap-2 text-sm text-sand-600">
                Reservas con <LogoMark className="h-5 w-5" />
                <span className="font-display font-bold text-primary-950">Agendik</span>
              </p>
            )}
            <LegalLinks />
          </div>
        </div>
      </main>
    </div>
  )
}

/** Servicio elegido en el portal (?servicio=<id>). Solo se acepta un id simple: nunca una ruta armada desde la URL. */
function servicioDelPortal(params) {
  const id = params.get('servicio')
  return id && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null
}

function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [olvide, setOlvide] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), mode: 'onBlur' })

  const onSubmit = async (values) => {
    try {
      const session = await login(values)
      const servicio = servicioDelPortal(params)
      // Cliente que eligió un servicio en el portal: directo a reservarlo.
      if (servicio && session.client && !session.staff && !session.isPlatformAdmin) {
        navigate(`/reservar?servicio=${encodeURIComponent(servicio)}`, { replace: true })
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError('root', { message: err.message })
    }
  }

  const fillDemo = () => {
    setValue('email', DEMO_CREDENTIALS.email, { shouldValidate: true })
    setValue('password', DEMO_CREDENTIALS.password, { shouldValidate: true })
  }

  if (olvide) return <OlvideForm onVolver={() => setOlvide(false)} />

  return (
    <div>
      <h1 className="font-display text-[1.875rem] font-extrabold leading-tight text-primary-950">Ingresá a tu cuenta</h1>
      <p className="mt-2 text-base text-sand-600">Gestioná tus citas y tus paquetes.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-2">
        {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}

        <Field reserve label="Email" htmlFor="login-email" error={errors.email?.message} required>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            className="input"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field reserve label="Contraseña" htmlFor="login-password" error={errors.password?.message} required>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="input pr-12"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-sand-600 transition-colors hover:text-primary-800"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
          {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </button>

        <button
          type="button"
          onClick={() => setOlvide(true)}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-center text-sm font-medium text-sand-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline"
        >
          Olvidé mi contraseña
        </button>
      </form>

      {isDemoMode && (
        <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-4">
          <p className="text-sm text-accent-900">
            <span className="font-semibold">Modo demo.</span> Probá con la cuenta de ejemplo.
          </p>
          <button type="button" onClick={fillDemo} className="btn-outline mt-3 w-full">
            Completar datos de la demo
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Pide el mail para mandar el link de recuperación.
 *
 * Contesta lo mismo exista o no la cuenta: si dijera "ese email no está
 * registrado", cualquiera podría averiguar quién es cliente del negocio.
 */
function OlvideForm({ onVolver }) {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const pedir = async (ev) => {
    ev.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('Escribí un email válido.')
    }
    setError('')
    setEnviando(true)
    try {
      await backend.requestPasswordReset(email)
      setEnviado(true)
    } catch (err) {
      setError(err.message || 'No pudimos enviar el mail.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div>
        <h1 className="font-display text-[1.875rem] font-extrabold leading-tight text-primary-950">Revisá tu correo</h1>
        <p className="mt-2 text-base text-sand-600">
          Si <strong>{email.trim()}</strong> tiene una cuenta, le llega un link para poner
          una contraseña nueva. Puede tardar un par de minutos, y a veces cae en spam.
        </p>
        <button type="button" onClick={onVolver} className="btn-outline btn-lg mt-8 w-full">
          Volver a ingresar
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[1.875rem] font-extrabold leading-tight text-primary-950">Recuperar contraseña</h1>
      <p className="mt-2 text-base text-sand-600">Te mandamos un link para elegir una nueva.</p>

      <form onSubmit={pedir} noValidate className="mt-8 space-y-2">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field reserve label="Tu email" htmlFor="olv-email" required>
          <input
            id="olv-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </Field>
        <button type="submit" disabled={enviando} className="btn-primary btn-lg w-full">
          {enviando ? <Spinner className="h-4 w-4" /> : null}
          {enviando ? 'Enviando…' : 'Enviarme el link'}
        </button>
        <button
          type="button"
          onClick={onVolver}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-center text-sm font-medium text-sand-700 transition-colors hover:text-primary-800"
        >
          Volver
        </button>
      </form>
    </div>
  )
}

function RegisterForm({ onDone }) {
  const { register: signUp } = useAuth()
  // El negocio sale del portal donde se está registrando (/n/<slug>).
  const { tenant, loading: cargandoNegocio } = useTenant()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema), mode: 'onBlur' })

  const onSubmit = async ({ confirmPassword, acepta, ...values }) => {
    try {
      const res = await signUp({ ...values, tenantId: tenant?.id })
      toast.success(res?.message || 'Cuenta creada.')
      onDone()
    } catch (err) {
      setError('root', { message: err.message })
    }
  }

  // Sin negocio en la dirección no se puede crear una cuenta: no sabríamos a
  // qué negocio asociarla. Pasa si alguien entra directo a /ingresar.
  if (!cargandoNegocio && !tenant) {
    return (
      <div>
        <h1 className="font-display text-[1.875rem] font-extrabold leading-tight text-primary-950">Creá tu cuenta</h1>
        <p className="mt-2 text-base text-sand-600">
          Para registrarte entrá con el link que te pasó el negocio, que se ve así:{' '}
          <span className="whitespace-nowrap font-medium text-sand-700">/n/nombre-del-negocio</span>.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[1.875rem] font-extrabold leading-tight text-primary-950">Creá tu cuenta</h1>
      <p className="mt-2 text-base text-sand-600">Con tu email alcanza para empezar a reservar.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-2">
        {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}

        <Field reserve label="Nombre completo" htmlFor="reg-name" error={errors.name?.message} required>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Camila Duarte"
            className="input"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>

        <Field reserve label="Email" htmlFor="reg-email" error={errors.email?.message} required>
          <input
            id="reg-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            className="input"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label="Teléfono"
          htmlFor="reg-phone"
          error={errors.phone?.message}
          hint="Lo usamos para avisarte si hay algún cambio."
          required
        >
          <input
            id="reg-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+595 981 234 567"
            className="input"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>

        <Field
          label="Contraseña"
          htmlFor="reg-password"
          error={errors.password?.message}
          hint="Mínimo 8 caracteres."
          required
        >
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className="input pr-12"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-sand-600 transition-colors hover:text-primary-800"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <Field reserve label="Repetí la contraseña" htmlFor="reg-confirm" error={errors.confirmPassword?.message} required>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="input"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        {legalListo && (
          <div className="pb-4">
            <CasillaLegal id="reg-acepta" error={errors.acepta?.message} {...register('acepta')} />
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
          {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}
