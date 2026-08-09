import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../../api/backend'
import { Field, Modal, Spinner } from '../ui'

const VACIO = { name: '', email: '', phone: '', birthDate: '', occupation: '', address: '' }

/**
 * Alta y edición de clientes desde el panel.
 *
 * No crea usuario de login: la mayoría reserva por WhatsApp y nunca entra a
 * la app. Si esa persona después se registra con el mismo email, adopta esta
 * ficha con todo su historial.
 */
export default function ClientFormModal({ open, onClose, onSaved, tenantId, cliente }) {
  const editando = Boolean(cliente)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrores({})
    setForm(
      cliente
        ? {
            name: cliente.name || '',
            email: cliente.email || '',
            phone: cliente.phone || '',
            birthDate: cliente.birthDate || '',
            occupation: cliente.occupation || '',
            address: cliente.address || '',
          }
        : VACIO,
    )
  }, [open, cliente])

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const validar = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Poné el nombre.'
    if (!editando) {
      if (!form.email.trim()) e.email = 'Poné el email.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Ese email no parece válido.'
    }
    if (form.phone && !/^\+?[\d\s-]{6,}$/.test(form.phone.trim())) e.phone = 'Ese teléfono no parece válido.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      const guardado = editando
        ? await backend.updateClientAsStaff(cliente.id, { ...form, status: cliente.status })
        : await backend.createClient({ ...form, tenantId })
      toast.success(editando ? 'Cliente actualizado.' : `${guardado.name} quedó en tu lista.`)
      onSaved?.(guardado)
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar cliente' : 'Nuevo cliente'}
      description={
        editando
          ? 'El email no se cambia: es lo que vincula la ficha con su cuenta.'
          : 'Queda fichado para que puedas agendarle. Si después se registra con este mismo email, hereda su historial.'
      }
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field label="Nombre y apellido" htmlFor="cli-nombre" required error={errores.name}>
          <input
            id="cli-nombre"
            className="input"
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            placeholder="Camila Duarte"
          />
        </Field>

        <Field
          label="Email"
          htmlFor="cli-email"
          required={!editando}
          error={errores.email}
          hint={editando ? undefined : 'Con este email va a poder crear su cuenta más adelante.'}
        >
          <input
            id="cli-email"
            type="email"
            className="input"
            value={form.email}
            onChange={set('email')}
            disabled={editando}
            placeholder="cliente@email.com"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" htmlFor="cli-tel" error={errores.phone} hint="Con código de país">
            <input
              id="cli-tel"
              className="input"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+595981234567"
            />
          </Field>

          <Field label="Cumpleaños" htmlFor="cli-cumple">
            <input id="cli-cumple" type="date" className="input" value={form.birthDate} onChange={set('birthDate')} />
          </Field>
        </div>

        <Field label="Ocupación" htmlFor="cli-ocupacion">
          <input id="cli-ocupacion" className="input" value={form.occupation} onChange={set('occupation')} />
        </Field>

        <Field label="Dirección" htmlFor="cli-direccion">
          <input id="cli-direccion" className="input" value={form.address} onChange={set('address')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando && <Spinner className="h-4 w-4" />}
            {editando ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
