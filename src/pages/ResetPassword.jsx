import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { backend } from '../api/backend'
import { Field, PageLoader, Spinner } from '../components/ui'
import { Logo } from '../components/Logo'

/**
 * Pantalla a la que llega el link del mail de recuperación.
 *
 * El link trae un token de un solo uso que deja una sesión temporal: con esa
 * sesión —y solo con esa— se puede guardar la contraseña nueva. Si el link
 * venció o alguien entra de prendido, no se muestra el formulario.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('verificando') // verificando | listo | invalido
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    backend
      .startPasswordRecovery()
      .then((ok) => activo && setEstado(ok ? 'listo' : 'invalido'))
      .catch(() => activo && setEstado('invalido'))
    return () => {
      activo = false
    }
  }, [])

  const guardar = async (ev) => {
    ev.preventDefault()
    if (password.length < 8) return setError('Usá al menos 8 caracteres.')
    if (password !== confirmar) return setError('Las contraseñas no coinciden.')
    setError('')
    setGuardando(true)
    try {
      await backend.completePasswordReset(password)
      toast.success('Listo, ya podés entrar con tu contraseña nueva.')
      navigate('/ingresar', { replace: true })
    } catch (err) {
      setError(err.message || 'No pudimos cambiar la contraseña.')
    } finally {
      setGuardando(false)
    }
  }

  if (estado === 'verificando') return <PageLoader label="Verificando el link…" />

  if (estado === 'invalido') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-sand-50 px-6 text-center">
        <Logo subtitle="Portal de citas" />
        <h1 className="mt-4 font-display text-2xl font-bold text-sand-900">
          Este link ya no sirve
        </h1>
        <p className="max-w-sm text-sm text-sand-500">
          Los links para cambiar la contraseña vencen al rato y se usan una sola vez. Pedí
          uno nuevo desde la pantalla de ingreso.
        </p>
        <Link to="/ingresar" className="btn-primary mt-2">
          Ir a ingresar
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sand-50 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo subtitle="Portal de citas" />
        </div>
        <div className="card">
          <h1 className="font-display text-2xl font-bold text-sand-900">Elegí tu contraseña</h1>
          <p className="mt-1 text-sm text-sand-500">
            Con esta contraseña vas a entrar de ahora en más.
          </p>

          <form onSubmit={guardar} className="mt-6 space-y-4" noValidate>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Field label="Contraseña nueva" htmlFor="rp-pass" required>
              <input
                id="rp-pass"
                type="password"
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Al menos 8 caracteres"
              />
            </Field>

            <Field label="Repetí la contraseña" htmlFor="rp-pass2" required>
              <input
                id="rp-pass2"
                type="password"
                autoComplete="new-password"
                className="input"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="La misma de arriba"
              />
            </Field>

            <button type="submit" disabled={guardando} className="btn-primary w-full">
              {guardando ? <Spinner /> : 'Guardar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
