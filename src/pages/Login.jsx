import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft, CalendarCheck, Eye, EyeOff, Layers, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { Field, Spinner } from '../components/ui'
import { Logo } from '../components/Logo'
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
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: 'Reservá en cuatro pasos' },
  { icon: Layers, text: 'Seguí las sesiones de tus paquetes' },
  { icon: ShieldCheck, text: 'Confirmá o cancelá cuando quieras' },
]

export default function Login() {
  const [tab, setTab] = useState('login')

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Panel de marca (solo desktop) */}
      <aside className="relative hidden overflow-hidden bg-primary-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-primary-800/40 blur-3xl"
        />
        <Link to="/" className="relative w-fit rounded-lg">
          <Logo subtitle="Portal de citas" tone="light" />
        </Link>

        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-extrabold leading-[1.1] text-white">
            Tu próxima cita, a un par de toques
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-900 text-accent-400">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-300">Horarios en zona América/Asunción</p>
      </aside>

      {/* Formularios */}
      <main className="flex min-h-dvh flex-col justify-center bg-sand-50 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-sand-600 transition-colors hover:text-primary-800 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>

          <div className="mb-6 lg:hidden">
            <Logo subtitle="Portal de citas" />
          </div>

          <div
            role="tablist"
            aria-label="Ingresar o crear cuenta"
            className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-sand-200/60 p-1"
          >
            {[
              { id: 'login', label: 'Ingresar' },
              { id: 'register', label: 'Crear cuenta' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-[44px] cursor-pointer rounded-lg px-4 text-sm font-semibold transition-all duration-200 ${
                  tab === id ? 'bg-white text-primary-800 shadow-soft' : 'text-sand-600 hover:text-sand-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? <LoginForm /> : <RegisterForm onDone={() => setTab('login')} />}
        </div>
      </main>
    </div>
  )
}

function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
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
      await login(values)
      toast.success('¡Hola de nuevo!')
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
    <div className="card">
      <h1 className="font-display text-2xl font-bold text-sand-900">Ingresá a tu cuenta</h1>
      <p className="mt-1 text-sm text-sand-500">Gestioná tus citas y tus paquetes.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
            {errors.root.message}
          </p>
        )}

        <Field label="Email" htmlFor="login-email" error={errors.email?.message} required>
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

        <Field label="Contraseña" htmlFor="login-password" error={errors.password?.message} required>
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
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-sand-400 transition-colors hover:text-sand-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </button>

        <button
          type="button"
          onClick={() => setOlvide(true)}
          className="w-full cursor-pointer text-center text-sm text-sand-500 underline-offset-2 hover:text-sand-800 hover:underline"
        >
          Olvidé mi contraseña
        </button>
      </form>

      {isDemoMode && (
        <div className="mt-5 rounded-xl border border-accent-200 bg-accent-50 p-3.5">
          <p className="text-xs text-accent-900">
            <span className="font-semibold">Modo demo.</span> Probá con la cuenta de ejemplo.
          </p>
          <button type="button" onClick={fillDemo} className="btn-outline mt-2.5 w-full py-2 text-xs">
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
      <div className="card">
        <h1 className="font-display text-2xl font-bold text-sand-900">Revisá tu correo</h1>
        <p className="mt-2 text-sm text-sand-500">
          Si <strong>{email.trim()}</strong> tiene una cuenta, le llega un link para poner
          una contraseña nueva. Puede tardar un par de minutos, y a veces cae en spam.
        </p>
        <button type="button" onClick={onVolver} className="btn-outline mt-6 w-full py-3">
          Volver a ingresar
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="font-display text-2xl font-bold text-sand-900">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-sand-500">Te mandamos un link para elegir una nueva.</p>

      <form onSubmit={pedir} noValidate className="mt-6 space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field label="Tu email" htmlFor="olv-email" required>
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
        <button type="submit" disabled={enviando} className="btn-primary w-full py-3">
          {enviando ? <Spinner className="h-4 w-4" /> : null}
          {enviando ? 'Enviando…' : 'Enviarme el link'}
        </button>
        <button
          type="button"
          onClick={onVolver}
          className="w-full cursor-pointer text-center text-sm text-sand-500 hover:text-sand-800"
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

  const onSubmit = async ({ confirmPassword, ...values }) => {
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
      <div className="card">
        <h1 className="font-display text-2xl font-bold text-sand-900">Creá tu cuenta</h1>
        <p className="mt-2 text-sm text-sand-500">
          Para registrarte entrá con el link que te pasó el negocio, que se ve así:{' '}
          <span className="whitespace-nowrap font-medium text-sand-700">/n/nombre-del-negocio</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="font-display text-2xl font-bold text-sand-900">Creá tu cuenta</h1>
      <p className="mt-1 text-sm text-sand-500">Con tu email alcanza para empezar a reservar.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
            {errors.root.message}
          </p>
        )}

        <Field label="Nombre completo" htmlFor="reg-name" error={errors.name?.message} required>
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

        <Field label="Email" htmlFor="reg-email" error={errors.email?.message} required>
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
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-sand-400 transition-colors hover:text-sand-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <Field label="Repetí la contraseña" htmlFor="reg-confirm" error={errors.confirmPassword?.message} required>
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

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}
