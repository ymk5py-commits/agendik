import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, RotateCcw, Scissors, Trash2 } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Field, Modal, Skeleton, Spinner } from '../components/ui'
import { formatDuration, formatGs } from '../utils/format'

const VACIO = { name: '', category: '', durationMin: 60, price: 0, capacity: 1 }

export default function AdminServices() {
  const { staff } = useAuth()
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [mostrarBajas, setMostrarBajas] = useState(false)

  const servicios = useAsync(() => backend.getServices({ todos: true }), [], { initialData: [] })
  const lista = servicios.data || []

  const visibles = useMemo(
    () => (mostrarBajas ? lista : lista.filter((s) => s.active)),
    [lista, mostrarBajas],
  )

  const porCategoria = useMemo(() => {
    const mapa = new Map()
    for (const s of visibles) {
      if (!mapa.has(s.category)) mapa.set(s.category, [])
      mapa.get(s.category).push(s)
    }
    return [...mapa].sort(([a], [b]) => a.localeCompare(b))
  }, [visibles])

  const categorias = useMemo(() => [...new Set(lista.map((s) => s.category))].sort(), [lista])
  const dadosDeBaja = lista.filter((s) => !s.active).length

  const cambiarEstado = async (servicio) => {
    try {
      await backend.setServiceActive(servicio.id, !servicio.active)
      toast.success(servicio.active ? `${servicio.name} dado de baja.` : `${servicio.name} reactivado.`)
      servicios.reload()
    } catch (err) {
      toast.error(err.message || 'No pudimos cambiar el servicio.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Servicios</h1>
          <p className="mt-1 text-base text-sand-700">
            Lo que ofrecés, cuánto dura y cuánto sale. Es lo que ven tus clientes al reservar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditando(null)
            setAbierto(true)
          }}
          className="btn-primary btn-lg"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo servicio
        </button>
      </header>

      {dadosDeBaja > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-sand-600">
          <input
            type="checkbox"
            checked={mostrarBajas}
            onChange={(e) => setMostrarBajas(e.target.checked)}
            className="h-5 w-5 cursor-pointer rounded border-edge accent-primary-700"
          />
          Mostrar los {dadosDeBaja} dados de baja
        </label>
      )}

      {servicios.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {servicios.error && <ErrorState message={servicios.error} onRetry={servicios.reload} />}

      {!servicios.loading && !servicios.error && visibles.length === 0 && (
        <EmptyState
          icon={Scissors}
          title="Todavía no cargaste servicios"
          description="Sin servicios tus clientes no pueden reservar. Cargá el primero."
          action={
            <button
              type="button"
              onClick={() => {
                setEditando(null)
                setAbierto(true)
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo servicio
            </button>
          }
        />
      )}

      <div className="space-y-6">
        {porCategoria.map(([categoria, delGrupo]) => (
          <section key={categoria}>
            <h2 className="mb-3 font-display text-xl font-bold">{categoria}</h2>
            <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
              {delGrupo.map((s) => (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center gap-4 p-4 sm:p-5 ${s.active ? '' : 'opacity-60'}`}
                >
                  <div className="min-w-[10rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sand-900">{s.name}</span>
                      {!s.active && <span className="chip bg-sand-100 text-sand-600">Dado de baja</span>}
                      {s.capacity > 1 && (
                        <span className="chip bg-primary-100 text-primary-800">
                          Grupal · {s.capacity} lugares
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-sand-700">{formatDuration(s.durationMin)}</p>
                  </div>

                  <span className="tabular font-semibold text-sand-900">{formatGs(s.price)}</span>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(s)
                        setAbierto(true)
                      }}
                      aria-label={`Editar ${s.name}`}
                      className="btn-ghost min-w-[44px] px-3"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstado(s)}
                      aria-label={s.active ? `Dar de baja ${s.name}` : `Reactivar ${s.name}`}
                      className={s.active ? 'btn-ghost min-w-[44px] px-3 text-rose-700' : 'btn-ghost min-w-[44px] px-3 text-emerald-700'}
                    >
                      {s.active ? (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ServiceModal
        open={abierto}
        onClose={() => setAbierto(false)}
        onSaved={() => servicios.reload()}
        tenantId={staff?.tenantId}
        servicio={editando}
        categorias={categorias}
      />
    </div>
  )
}

function ServiceModal({ open, onClose, onSaved, tenantId, servicio, categorias }) {
  const editando = Boolean(servicio)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  // Se rearma cada vez que se abre, para no arrastrar el servicio anterior.
  const [abiertoAntes, setAbiertoAntes] = useState(false)
  if (open !== abiertoAntes) {
    setAbiertoAntes(open)
    if (open) {
      setErrores({})
      setForm(
        servicio
          ? {
              name: servicio.name,
              category: servicio.category,
              durationMin: servicio.durationMin,
              price: servicio.price,
              capacity: servicio.capacity ?? 1,
            }
          : VACIO,
      )
    }
  }

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const guardar = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!String(form.name).trim()) e.name = 'Poné el nombre del servicio.'
    if (!String(form.category).trim()) e.category = 'Elegí o escribí una categoría.'
    if (!Number(form.durationMin) || Number(form.durationMin) < 5) e.durationMin = 'Mínimo 5 minutos.'
    if (Number(form.price) < 0) e.price = 'El precio no puede ser negativo.'
    if (!Number(form.capacity) || Number(form.capacity) < 1) e.capacity = 'Mínimo 1 persona.'
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await backend.saveService({
        id: servicio?.id,
        tenantId,
        name: form.name,
        category: form.category,
        durationMin: form.durationMin,
        price: form.price,
        capacity: form.capacity,
        active: servicio ? servicio.active : true,
      })
      toast.success(editando ? 'Servicio actualizado.' : 'Servicio creado.')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar el servicio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar servicio' : 'Nuevo servicio'}
      description="La duración define cuánto ocupa en la agenda del profesional."
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="svc-nombre" required error={errores.name}>
          <input
            id="svc-nombre"
            className="input"
            value={form.name}
            onChange={set('name')}
            placeholder="Corte & Brushing"
          />
        </Field>

        <Field
          label="Categoría"
          htmlFor="svc-categoria"
          required
          error={errores.category}
          hint="Agrupa los servicios en el buscador del cliente."
        >
          <input
            id="svc-categoria"
            className="input"
            list="svc-categorias"
            value={form.category}
            onChange={set('category')}
            placeholder="Cabello"
          />
          <datalist id="svc-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duración (minutos)" htmlFor="svc-duracion" required error={errores.durationMin}>
            <input
              id="svc-duracion"
              type="number"
              min="5"
              step="5"
              className="input"
              value={form.durationMin}
              onChange={set('durationMin')}
            />
          </Field>

          <Field label="Precio (Gs.)" htmlFor="svc-precio" required error={errores.price}>
            <input
              id="svc-precio"
              type="number"
              min="0"
              step="1000"
              className="input"
              value={form.price}
              onChange={set('price')}
            />
          </Field>
        </div>

        <Field
          label="Personas por turno"
          htmlFor="svc-cupos"
          required
          error={errores.capacity}
          hint={
            Number(form.capacity) > 1
              ? `Clase grupal: entran ${form.capacity} personas en el mismo horario y el turno deja de ofrecerse cuando se llena.`
              : 'Dejalo en 1 para atención individual. Subilo para clases grupales, como pilates.'
          }
        >
          <input
            id="svc-cupos"
            type="number"
            min="1"
            step="1"
            className="input"
            value={form.capacity}
            onChange={set('capacity')}
          />
        </Field>

        {Number(form.durationMin) > 0 && (
          <p className="rounded-xl bg-sand-100 px-3 py-2 text-sm text-sand-700">
            {formatDuration(Number(form.durationMin))} · <span className="tabular font-semibold">{formatGs(form.price)}</span>
            {Number(form.capacity) > 1 && <> · {form.capacity} lugares por turno</>}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando && <Spinner className="h-4 w-4" />}
            {editando ? 'Guardar cambios' : 'Crear servicio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
