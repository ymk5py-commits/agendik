import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarRange, Pencil, Plus } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Field, Modal, Skeleton, Spinner } from '../components/ui'
import { formatGs } from '../utils/format'

/**
 * Los planes del negocio: cuotas que se renuevan cada mes.
 *
 * Distinto de los paquetes, que se compran una vez y se agotan. Acá se define
 * la plantilla ("Pilates 2 veces por semana, 8 usos al mes"); asignársela a
 * alguien se hace desde la ficha del cliente.
 */
export default function AdminPlans() {
  const { staff } = useAuth()
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)

  const planes = useAsync(() => backend.getPlans(), [], { initialData: [] })
  const servicios = useAsync(() => backend.getServices({ todos: true }), [], { initialData: [] })
  const lista = planes.data || []

  const abrirNuevo = () => {
    setEditando(null)
    setAbierto(true)
  }

  const nombresDe = (ids) =>
    (servicios.data || [])
      .filter((s) => ids.includes(s.id))
      .map((s) => s.name)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Planes</h1>
          <p className="mt-0.5 text-sm text-sand-500">
            Cuotas que se renuevan cada mes. El contador vuelve a empezar en la fecha en que
            cada cliente se suscribió.
          </p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-accent">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo plan
        </button>
      </div>

      {planes.loading && <Skeleton className="h-24" />}
      {planes.error && <ErrorState onRetry={planes.reload} />}

      {!planes.loading && !planes.error && lista.length === 0 && (
        <EmptyState
          icon={CalendarRange}
          title="Todavía no hay planes"
          description="Por ejemplo: “Pilates 2 veces por semana”, 8 usos al mes."
          action={
            <button type="button" onClick={abrirNuevo} className="btn-primary">
              Crear el primero
            </button>
          }
        />
      )}

      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((p) => {
            const cubre = nombresDe(p.serviceIds)
            return (
              <li key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sand-900">
                    {p.name}
                    {!p.active && (
                      <span className="chip ml-2 bg-sand-100 text-sand-600">Inactivo</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-sand-500">
                    {cubre.length ? cubre.join(' · ') : 'Sin servicios asignados'}
                  </p>
                </div>

                <div className="text-center">
                  <p className="tabular text-lg font-bold text-primary-700">{p.usesPerPeriod}</p>
                  <p className="text-xs text-sand-500">usos/mes</p>
                </div>

                <div className="text-right">
                  <p className="tabular font-semibold text-sand-900">{formatGs(p.price)}</p>
                  <p className="text-xs text-sand-500">por mes</p>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await backend.setPlanActive(p.id, !p.active)
                        toast.success(p.active ? 'Plan pausado.' : 'Plan reactivado.')
                        planes.reload()
                      } catch (e) {
                        toast.error(e.message)
                      }
                    }}
                    className="btn-outline px-3 py-2 text-sm"
                  >
                    {p.active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(p)
                      setAbierto(true)
                    }}
                    aria-label={`Editar ${p.name}`}
                    className="btn-ghost px-2.5"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <PlanModal
        open={abierto}
        onClose={() => setAbierto(false)}
        onSaved={() => planes.reload()}
        tenantId={staff?.tenantId}
        plan={editando}
        servicios={servicios.data || []}
      />
    </div>
  )
}

const VACIO = { name: '', usesPerPeriod: 8, price: '', serviceIds: [] }

function PlanModal({ open, onClose, onSaved, tenantId, plan, servicios }) {
  const editando = Boolean(plan)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrores({})
    setForm(
      plan
        ? {
            name: plan.name,
            usesPerPeriod: plan.usesPerPeriod,
            price: String(plan.price || ''),
            serviceIds: plan.serviceIds || [],
          }
        : VACIO,
    )
  }, [open, plan])

  const alternarServicio = (id) =>
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((x) => x !== id)
        : [...f.serviceIds, id],
    }))

  const guardar = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!form.name.trim()) e.name = 'Poné un nombre.'
    if (!(Number(form.usesPerPeriod) > 0)) e.usesPerPeriod = 'Tiene que ser mayor que cero.'
    if (form.serviceIds.length === 0) e.serviceIds = 'Elegí al menos un servicio.'
    setErrores(e)
    if (Object.keys(e).length) return

    setGuardando(true)
    try {
      await backend.savePlan({
        id: plan?.id,
        tenantId,
        name: form.name,
        usesPerPeriod: form.usesPerPeriod,
        price: form.price,
        active: plan?.active !== false,
        serviceIds: form.serviceIds,
      })
      toast.success(editando ? 'Plan actualizado.' : 'Plan creado.')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar el plan.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar plan' : 'Nuevo plan'}
      description="El contador se renueva cada mes desde la fecha en que se suscribió cada cliente."
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field label="Nombre del plan" htmlFor="pl-nombre" required error={errores.name}>
          <input
            id="pl-nombre"
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Pilates 2 veces por semana"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Usos por mes"
            htmlFor="pl-usos"
            required
            error={errores.usesPerPeriod}
            hint="2 veces por semana ≈ 8"
          >
            <input
              id="pl-usos"
              type="number"
              min="1"
              className="input"
              value={form.usesPerPeriod}
              onChange={(e) => setForm((f) => ({ ...f, usesPerPeriod: e.target.value }))}
            />
          </Field>
          <Field label="Precio por mes" htmlFor="pl-precio">
            <input
              id="pl-precio"
              type="number"
              min="0"
              className="input"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="300000"
            />
          </Field>
        </div>

        <Field
          label="Servicios que cubre"
          required
          error={errores.serviceIds}
          hint="El plan solo sirve para estos servicios; el resto se paga aparte."
        >
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-sand-200 p-2">
            {servicios.length === 0 && (
              <p className="px-2 py-3 text-sm text-sand-500">Primero cargá servicios.</p>
            )}
            {servicios.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-sand-50"
              >
                <input
                  type="checkbox"
                  checked={form.serviceIds.includes(s.id)}
                  onChange={() => alternarServicio(s.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-sand-800">{s.name}</span>
                <span className="ml-auto text-xs text-sand-400">{s.durationMin} min</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? <Spinner /> : 'Guardar plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
