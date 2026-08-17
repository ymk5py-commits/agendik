import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../../api/backend'
import { Field, Modal, Spinner } from '../ui'

const VACIO = { businessName: '', slug: '', phone: '', ownerName: '', ownerEmail: '' }

/** "Estudio Alma" → "estudio-alma" */
function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Alta de un negocio nuevo y de la cuenta de quien lo va a administrar.
 *
 * Al guardar, la contraseña del dueño se muestra en pantalla una sola vez: no
 * le llega ningún mail, así que si no se copia acá se pierde. Por eso el modal
 * no se cierra solo al crear — queda mostrando el resultado hasta que la
 * copien.
 */
export default function BusinessFormModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [creado, setCreado] = useState(null)
  const [slugTocado, setSlugTocado] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(VACIO)
    setErrores({})
    setCreado(null)
    setSlugTocado(false)
  }, [open])

  const set = (campo) => (e) => {
    const valor = e.target.value
    setForm((f) => {
      // El slug se arma solo desde el nombre hasta que lo editen a mano.
      if (campo === 'businessName' && !slugTocado) {
        return { ...f, businessName: valor, slug: aSlug(valor) }
      }
      return { ...f, [campo]: valor }
    })
  }

  const validar = () => {
    const e = {}
    if (!form.businessName.trim()) e.businessName = 'Poné el nombre del negocio.'
    if (!form.slug.trim()) e.slug = 'Poné la dirección web.'
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(form.slug.trim())) {
      e.slug = 'Solo minúsculas, números y guiones.'
    }
    if (!form.ownerEmail.trim()) e.ownerEmail = 'Poné el email del dueño.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) {
      e.ownerEmail = 'Ese email no parece válido.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      const res = await backend.createBusiness({
        slug: form.slug.trim(),
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerName: form.ownerName.trim(),
      })
      setCreado(res)
      toast.success(`${form.businessName.trim()} quedó creado.`)
      onCreated?.()
    } catch (err) {
      toast.error(err.message || 'No pudimos crear el negocio.')
    } finally {
      setGuardando(false)
    }
  }

  if (creado) {
    const link = `${window.location.origin}/n/${creado.slug}`
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Negocio creado"
        description="Pasale estos datos al dueño. La contraseña no se vuelve a mostrar."
      >
        <div className="space-y-4">
          <div className="card space-y-3 bg-sand-50 p-4">
            <div>
              <p className="text-xs text-sand-500">Entra con</p>
              <p className="font-semibold text-sand-900">{creado.ownerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-sand-500">Contraseña temporal</p>
              <p className="tabular text-xl font-bold text-primary-700">{creado.ownerPassword}</p>
            </div>
            <div>
              <p className="text-xs text-sand-500">Portal de sus clientes</p>
              <p className="break-all text-sm text-sand-700">{link}</p>
            </div>
          </div>
          <p className="text-sm text-sand-500">
            Conviene que la cambie al entrar, desde <strong>Mi cuenta</strong>.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn-primary">
              Listo, ya la copié
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo negocio"
      description="Se crea el negocio y la cuenta de quien lo administra."
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field label="Nombre del negocio" htmlFor="neg-nombre" required error={errores.businessName}>
          <input
            id="neg-nombre"
            className="input"
            value={form.businessName}
            onChange={set('businessName')}
            placeholder="Estudio Alma"
          />
        </Field>

        <Field
          label="Dirección web"
          htmlFor="neg-slug"
          required
          error={errores.slug}
          hint={`Sus clientes van a reservar en /n/${form.slug || 'nombre-del-negocio'}`}
        >
          <input
            id="neg-slug"
            className="input"
            value={form.slug}
            onChange={(e) => {
              setSlugTocado(true)
              setForm((f) => ({ ...f, slug: e.target.value }))
            }}
            placeholder="estudio-alma"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </Field>

        <Field label="Teléfono del negocio" htmlFor="neg-tel" hint="Con código de país">
          <input id="neg-tel" className="input" value={form.phone} onChange={set('phone')} placeholder="+595981234567" />
        </Field>

        <div className="border-t border-sand-200 pt-4">
          <p className="mb-3 text-sm font-semibold text-sand-900">Quién lo administra</p>
          <div className="space-y-4">
            <Field label="Nombre" htmlFor="neg-duenio" error={errores.ownerName}>
              <input
                id="neg-duenio"
                className="input"
                value={form.ownerName}
                onChange={set('ownerName')}
                placeholder="Rocío Fernández"
              />
            </Field>
            <Field
              label="Email"
              htmlFor="neg-email"
              required
              error={errores.ownerEmail}
              hint="Con este email entra al panel. Le vas a tener que pasar vos la contraseña."
            >
              <input
                id="neg-email"
                type="email"
                className="input"
                value={form.ownerEmail}
                onChange={set('ownerEmail')}
                placeholder="duenio@negocio.com"
                autoCapitalize="off"
                spellCheck="false"
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? <Spinner /> : 'Crear negocio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
