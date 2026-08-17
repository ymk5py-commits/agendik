import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../../api/backend'
import { Field, Modal, Spinner } from '../ui'

/**
 * Le pone una contraseña nueva a un cliente que perdió la suya.
 *
 * Existe porque sin servidor de mail no hay "olvidé mi contraseña" que valga:
 * la persona llama al negocio y se lo resuelven en el momento.
 *
 * La contraseña se muestra en pantalla a propósito. El mostrador se la tiene
 * que dictar a alguien que está del otro lado del teléfono, y una contraseña
 * que no se puede leer no sirve para eso.
 */
export default function ClientPasswordModal({ cliente, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setPassword('')
    setError('')
  }, [cliente])

  const sugerir = () => {
    // Sin caracteres que se confundan al dictarla por teléfono: 0/O, 1/l/I.
    const letras = 'abcdefghjkmnpqrstuvwxyz'
    const numeros = '23456789'
    const azar = (set, n) =>
      Array.from(crypto.getRandomValues(new Uint32Array(n)))
        .map((v) => set[v % set.length])
        .join('')
    setPassword(`${azar(letras, 4)}-${azar(numeros, 4)}-${azar(letras, 4)}`)
    setError('')
  }

  const guardar = async (ev) => {
    ev.preventDefault()
    if (password.trim().length < 8) {
      setError('Usá al menos 8 caracteres.')
      return
    }
    setGuardando(true)
    try {
      await backend.setClientPassword(cliente.id, password.trim())
      toast.success(`Contraseña nueva para ${cliente.name}.`)
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos cambiar la contraseña.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={Boolean(cliente)}
      onClose={onClose}
      title="Cambiar contraseña"
      description={
        cliente
          ? `${cliente.name} va a entrar al portal con esta contraseña. Se le cierran las sesiones que tenga abiertas.`
          : undefined
      }
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field
          label="Contraseña nueva"
          htmlFor="cli-pass"
          required
          error={error}
          hint="Se la tenés que pasar vos: no le llega ningún mail."
        >
          <input
            id="cli-pass"
            className="input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            autoComplete="off"
            spellCheck="false"
            placeholder="Al menos 8 caracteres"
          />
        </Field>

        <button type="button" onClick={sugerir} className="btn-ghost text-sm">
          Generar una fácil de dictar
        </button>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? <Spinner /> : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
