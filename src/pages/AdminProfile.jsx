import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { KeyRound, Mail, ShieldCheck, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../api/backend'
import { Field, Spinner } from '../components/ui'
import { initials } from '../utils/format'

const ROL = {
  owner: { label: 'Dueña del negocio', detalle: 'Acceso completo a la agenda y a los clientes.' },
  staff: { label: 'Equipo', detalle: 'Puede ver la agenda y gestionar las citas del negocio.' },
}

const datosSchema = z.object({
  name: z.string().trim().min(2, 'Poné tu nombre completo.'),
})

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Usá al menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

export default function AdminProfile() {
  const { staff, tenant, updateStaff } = useAuth()
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const rol = ROL[staff?.role] || ROL.staff

  const datosForm = useForm({
    resolver: zodResolver(datosSchema),
    mode: 'onBlur',
    defaultValues: { name: staff?.name || '' },
  })

  const claveForm = useForm({
    resolver: zodResolver(passwordSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  })

  const guardarDatos = datosForm.handleSubmit(async ({ name }) => {
    try {
      const actualizado = await backend.updateStaffProfile(staff.id, { name })
      updateStaff({ name: actualizado.name })
      toast.success('Tus datos quedaron guardados.')
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar tus datos.')
    }
  })

  const guardarClave = claveForm.handleSubmit(async ({ password }) => {
    try {
      await backend.updateStaffProfile(staff.id, { name: staff.name, password })
      toast.success('Contraseña actualizada.')
      claveForm.reset()
      setCambiandoClave(false)
    } catch (err) {
      toast.error(err.message || 'No pudimos cambiar la contraseña.')
    }
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-sand-900 sm:text-3xl">Mi cuenta</h1>
        <p className="mt-1 text-sm text-sand-600">Tus datos de acceso al panel del negocio.</p>
      </header>

      <section className="card">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-lg font-bold text-white"
          >
            {initials(staff?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-sand-900">{staff?.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-sand-500">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {rol.label}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-3 border-t border-sand-200 pt-5 text-sm">
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sand-400" aria-hidden="true" />
            <div>
              <dt className="text-sand-500">Email de acceso</dt>
              <dd className="font-medium text-sand-900">{staff?.email}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-sand-400" aria-hidden="true" />
            <div>
              <dt className="text-sand-500">Negocio</dt>
              <dd className="font-medium text-sand-900">{tenant?.businessName}</dd>
            </div>
          </div>
        </dl>

        <p className="mt-4 rounded-xl bg-sand-100 px-3.5 py-2.5 text-xs text-sand-600">
          El email y tu rol no se cambian desde acá. Son la llave de tu acceso, así que los ajusta
          quien administra el negocio directamente en la base.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-sand-900">Tus datos</h2>
        <form onSubmit={guardarDatos} className="mt-4 space-y-4" noValidate>
          <Field
            label="Nombre y apellido"
            htmlFor="admin-nombre"
            required
            error={datosForm.formState.errors.name?.message}
            hint="Es el nombre que se ve en el panel."
          >
            <input id="admin-nombre" className="input" autoComplete="name" {...datosForm.register('name')} />
          </Field>

          <div className="flex justify-end">
            <button type="submit" disabled={datosForm.formState.isSubmitting} className="btn-primary">
              {datosForm.formState.isSubmitting && <Spinner className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-sand-900">Contraseña</h2>
            <p className="mt-0.5 text-sm text-sand-600">
              {cambiandoClave ? 'Elegí una nueva de al menos 8 caracteres.' : 'Cambiala cada tanto.'}
            </p>
          </div>
          {!cambiandoClave && (
            <button type="button" onClick={() => setCambiandoClave(true)} className="btn-outline">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Cambiar contraseña
            </button>
          )}
        </div>

        {cambiandoClave && (
          <form onSubmit={guardarClave} className="mt-4 space-y-4" noValidate>
            <Field
              label="Nueva contraseña"
              htmlFor="admin-pass"
              required
              error={claveForm.formState.errors.password?.message}
            >
              <input
                id="admin-pass"
                type="password"
                className="input"
                autoComplete="new-password"
                {...claveForm.register('password')}
              />
            </Field>

            <Field
              label="Repetila"
              htmlFor="admin-pass2"
              required
              error={claveForm.formState.errors.confirmPassword?.message}
            >
              <input
                id="admin-pass2"
                type="password"
                className="input"
                autoComplete="new-password"
                {...claveForm.register('confirmPassword')}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  claveForm.reset()
                  setCambiandoClave(false)
                }}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button type="submit" disabled={claveForm.formState.isSubmitting} className="btn-primary">
                {claveForm.formState.isSubmitting && <Spinner className="h-4 w-4" />}
                Guardar contraseña
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
