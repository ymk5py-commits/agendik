import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { Field, Spinner } from '../components/ui'
import { initials } from '../utils/format'

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
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-sand-900 sm:text-3xl">Mi perfil</h1>
        <p className="mt-1 text-sm text-sand-500">Mantené tus datos al día para que podamos avisarte de cambios.</p>
      </div>

      <section className="card flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-800 font-display text-xl font-extrabold text-white"
        >
          {initials(client?.name)}
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-sand-900">{client?.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-sand-500">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{client?.email}</span>
          </p>
        </div>
      </section>

      <ProfileForm />
      <PasswordForm />
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
      <h2 className="font-display text-lg font-bold text-sand-900">Datos personales</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
            {errors.root.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="p-name" error={errors.name?.message} required>
            <input id="p-name" type="text" autoComplete="name" className="input" {...register('name')} />
          </Field>

          <Field label="Teléfono" htmlFor="p-phone" error={errors.phone?.message} required>
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

          <Field label="Fecha de nacimiento" htmlFor="p-birth" error={errors.birthDate?.message}>
            <input id="p-birth" type="date" className="input" {...register('birthDate')} />
          </Field>

          <Field label="Género" htmlFor="p-gender" error={errors.gender?.message}>
            <select id="p-gender" className="input" {...register('gender')}>
              <option value="">Prefiero no decirlo</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
            </select>
          </Field>

          <Field label="Ocupación" htmlFor="p-occupation" error={errors.occupation?.message}>
            <input id="p-occupation" type="text" className="input" {...register('occupation')} />
          </Field>

          <Field label="Dirección" htmlFor="p-address" error={errors.address?.message}>
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
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-sand-900">
            <ShieldCheck className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Seguridad
          </h2>
          <p className="mt-0.5 text-sm text-sand-500">Cambiá tu contraseña cuando quieras.</p>
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
          {errors.root && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
              {errors.root.message}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
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

            <Field label="Repetí la contraseña" htmlFor="p-confirm" error={errors.confirmPassword?.message} required>
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
