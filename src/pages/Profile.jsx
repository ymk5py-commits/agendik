import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Download, FileText, KeyRound, Mail, ShieldCheck, UserX } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { ErrorBanner, Field, Spinner } from '../components/ui'
import { initials, toDateKey } from '../utils/format'
import { OPERADOR, legalListo } from '../config/legal'

const profileSchema = z.object({
  name: z.string().min(3, 'Escribí tu nombre completo.'),
  phone: z.string().min(6, 'Ingresá un teléfono de contacto.'),
  birthDate: z.string().optional().or(z.literal('')),
  gender: z.enum(['', 'female', 'male', 'other']).optional(),
  occupation: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
})

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Usá al menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Repetí la contraseña.'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

export default function Profile() {
  const { client } = useAuth()

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Mi perfil</h1>
        <p className="mt-1 text-base text-sand-700">Mantené tus datos al día para que podamos avisarte de cambios.</p>
      </div>

      <section className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-800 font-display text-xl font-extrabold text-white"
        >
          {initials(client?.name)}
        </span>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold text-primary-950">{client?.name}</p>
          <p className="flex items-center gap-2 text-base text-sand-700">
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{client?.email}</span>
          </p>
        </div>
      </section>

      <ProfileForm />
      <PasswordForm />
      <MisDatos />
    </div>
  )
}

function ProfileForm() {
  const { client, updateClient } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      name: client?.name || '',
      phone: client?.phone || '',
      birthDate: client?.birthDate || '',
      gender: client?.gender || '',
      occupation: client?.occupation || '',
      address: client?.address || '',
    },
  })

  const onSubmit = async (values) => {
    try {
      const updated = await backend.updateProfile(client.id, values)
      updateClient(updated)
      reset(values)
      toast.success('Perfil actualizado.')
    } catch (err) {
      setError('root', { message: err.message })
    }
  }

  return (
    <section className="card">
      <h2 className="font-display text-xl font-bold">Datos personales</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
        {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}

        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          <Field reserve label="Nombre completo" htmlFor="p-name" error={errors.name?.message} required>
            <input id="p-name" type="text" autoComplete="name" className="input" {...register('name')} />
          </Field>

          <Field reserve label="Teléfono" htmlFor="p-phone" error={errors.phone?.message} required>
            <input
              id="p-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+595 981 234 567"
              className="input"
              {...register('phone')}
            />
          </Field>

          <Field reserve label="Fecha de nacimiento" htmlFor="p-birth" error={errors.birthDate?.message}>
            <input id="p-birth" type="date" className="input" {...register('birthDate')} />
          </Field>

          <Field reserve label="Género" htmlFor="p-gender" error={errors.gender?.message}>
            <select id="p-gender" className="input" {...register('gender')}>
              <option value="">Prefiero no decirlo</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
            </select>
          </Field>

          <Field reserve label="Ocupación" htmlFor="p-occupation" error={errors.occupation?.message}>
            <input id="p-occupation" type="text" className="input" {...register('occupation')} />
          </Field>

          <Field reserve label="Dirección" htmlFor="p-address" error={errors.address?.message}>
            <input id="p-address" type="text" autoComplete="street-address" className="input" {...register('address')} />
          </Field>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary">
            {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
            {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  )
}

function PasswordForm() {
  const { client } = useAuth()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema), mode: 'onBlur' })

  const onSubmit = async ({ password }) => {
    try {
      await backend.updateProfile(client.id, {
        name: client.name,
        phone: client.phone,
        birthDate: client.birthDate,
        gender: client.gender,
        occupation: client.occupation,
        address: client.address,
        password,
      })
      toast.success('Contraseña actualizada.')
      reset()
      setOpen(false)
    } catch (err) {
      setError('root', { message: err.message })
    }
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Seguridad
          </h2>
          <p className="mt-0.5 text-base text-sand-700">Cambiá tu contraseña cuando quieras.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            reset()
          }}
          aria-expanded={open}
          className="btn-outline"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {open ? 'Cancelar' : 'Cambiar contraseña'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4 animate-slide-up">
          {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}

          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field
              reserve
              label="Nueva contraseña"
              htmlFor="p-password"
              error={errors.password?.message}
              hint="Mínimo 8 caracteres."
              required
            >
              <input
                id="p-password"
                type="password"
                autoComplete="new-password"
                className="input"
                {...register('password')}
              />
            </Field>

            <Field reserve label="Repetí la contraseña" htmlFor="p-confirm" error={errors.confirmPassword?.message} required>
              <input
                id="p-confirm"
                type="password"
                autoComplete="new-password"
                className="input"
                {...register('confirmPassword')}
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
              {isSubmitting ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/**
 * Derechos de acceso y portabilidad (Ley 7593/2025): la persona se lleva una copia de todo lo suyo sin pedírselo a
 * nadie. La baja va por correo porque el negocio puede tener que conservar parte del historial por ley.
 */
function MisDatos() {
  const { client, tenant } = useAuth()
  const [descargando, setDescargando] = useState(false)

  const descargar = async () => {
    setDescargando(true)
    try {
      const [citas, paquetes, planes] = await Promise.all([
        backend.getAppointments(client.id),
        backend.getPackages(client.id).catch(() => []),
        backend.getMyPlans().catch(() => []),
      ])
      const copia = {
        generado: new Date().toISOString(),
        negocio: tenant?.businessName ?? null,
        perfil: client,
        citas,
        paquetes,
        planes,
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }))
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `mis-datos-agendik-${toDateKey(new Date())}.json`
      enlace.click()
      URL.revokeObjectURL(url)
      toast.success('Listo: descargamos una copia de tus datos.')
    } catch {
      toast.error('No pudimos preparar la copia. Probá de nuevo en un rato.')
    } finally {
      setDescargando(false)
    }
  }

  const pedidoDeBaja = `mailto:${OPERADOR.email}?subject=${encodeURIComponent('Baja de mi cuenta de Agendik')}&body=${encodeURIComponent(
    `Hola. Quiero dar de baja mi cuenta y que se borren mis datos.\n\nCorreo de la cuenta: ${client?.email ?? ''}\nNegocio: ${tenant?.businessName ?? ''}`,
  )}`

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <FileText className="h-5 w-5 text-primary-600" aria-hidden="true" />
        Tus datos
      </h2>
      <p className="mt-0.5 text-base text-sand-700">
        Llevate una copia de todo lo que guardamos sobre vos{legalListo ? ', o pedí que lo borremos' : ''}.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={descargar} disabled={descargando} className="btn-outline">
          {descargando ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {descargando ? 'Preparando…' : 'Descargar mis datos'}
        </button>
        {legalListo && (
          <a href={pedidoDeBaja} className="btn-ghost text-rose-700 hover:bg-rose-50 hover:text-rose-800">
            <UserX className="h-4 w-4" aria-hidden="true" />
            Pedir la baja de mi cuenta
          </a>
        )}
      </div>

      {legalListo && (
        <p className="mt-4 text-sm text-sand-700">
          Respondemos los pedidos dentro de los 30 días. Más detalles en la{' '}
          <Link to="/privacidad" className="font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-950">
            Política de privacidad
          </Link>
          .
        </p>
      )}
    </section>
  )
}
