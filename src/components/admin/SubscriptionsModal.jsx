import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../../api/backend'
import { Field, Modal, Spinner } from '../ui'
import { formatShortDate } from '../../utils/format'

/**
 * Los planes de un cliente: cuáles tiene y cuántos usos le quedan este mes.
 *
 * El número de usos lo calcula la base contando las citas del período, así que
 * lo que se ve acá es siempre el estado real, no un contador que se pudo haber
 * desincronizado.
 */
export default function SubscriptionsModal({ cliente, tenantId, onClose, onChanged }) {
  const [subs, setSubs] = useState([])
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [asignando, setAsignando] = useState(false)
  const [planId, setPlanId] = useState('')
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10))

  const cargar = async () => {
    if (!cliente) return
    setCargando(true)
    try {
      const [s, p] = await Promise.all([backend.getClientSubscriptions(cliente.id), backend.getPlans()])
      setSubs(s)
      setPlanes(p.filter((x) => x.active))
    } catch (e) {
      toast.error(e.message || 'No pudimos cargar los planes.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (cliente) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente])

  const asignar = async (ev) => {
    ev.preventDefault()
    if (!planId) return toast.error('Elegí un plan.')
    setAsignando(true)
    try {
      await backend.subscribeClient({ tenantId, clientId: cliente.id, planId, startedOn: desde })
      toast.success('Plan asignado.')
      setPlanId('')
      await cargar()
      onChanged?.()
    } catch (e) {
      toast.error(e.message || 'No pudimos asignar el plan.')
    } finally {
      setAsignando(false)
    }
  }

  const cambiarEstado = async (sub, status) => {
    try {
      await backend.setSubscriptionStatus(sub.id, status)
      toast.success(status === 'cancelled' ? 'Plan dado de baja.' : 'Plan actualizado.')
      await cargar()
      onChanged?.()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Modal
      open={Boolean(cliente)}
      onClose={onClose}
      title="Planes del cliente"
      description={cliente ? `${cliente.name} · se renueva cada mes` : undefined}
    >
      <div className="space-y-5">
        {cargando && <p className="text-sm text-sand-500">Cargando…</p>}

        {!cargando && subs.length === 0 && (
          <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-sand-600">
            Todavía no tiene ningún plan.
          </p>
        )}

        {subs.map((s) => (
          <div key={s.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sand-900">{s.planName}</p>
                <p className="text-xs text-sand-500">
                  Desde {formatShortDate(s.startedOn)}
                  {s.status !== 'active' && ` · ${s.status === 'paused' ? 'pausado' : 'dado de baja'}`}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-xl font-bold text-primary-700">
                  {s.restantes}
                  <span className="text-sm font-normal text-sand-400"> / {s.usesPerPeriod}</span>
                </p>
                <p className="text-xs text-sand-500">le quedan este mes</p>
              </div>
            </div>

            {s.periodStart && (
              <p className="text-xs text-sand-400">
                Período actual: {formatShortDate(s.periodStart)} a {formatShortDate(s.periodEnd)}
              </p>
            )}

            {s.status !== 'cancelled' && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cambiarEstado(s, s.status === 'active' ? 'paused' : 'active')}
                  className="btn-outline px-3 py-1.5 text-xs"
                >
                  {s.status === 'active' ? 'Pausar' : 'Reactivar'}
                </button>
                <button
                  type="button"
                  onClick={() => cambiarEstado(s, 'cancelled')}
                  className="btn-ghost px-3 py-1.5 text-xs text-red-700"
                >
                  Dar de baja
                </button>
              </div>
            )}
          </div>
        ))}

        <form onSubmit={asignar} className="space-y-3 border-t border-sand-200 pt-4">
          <p className="text-sm font-semibold text-sand-900">Asignar un plan</p>
          {planes.length === 0 ? (
            <p className="text-sm text-sand-500">
              No hay planes activos. Creá uno primero desde <strong>Planes</strong>.
            </p>
          ) : (
            <>
              <Field label="Plan" htmlFor="sub-plan">
                <select
                  id="sub-plan"
                  className="input"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  <option value="">Elegí un plan…</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.usesPerPeriod} usos/mes
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Arranca el"
                htmlFor="sub-desde"
                hint="Desde esta fecha se cuenta el mes: si es un 12, se renueva cada 12."
              >
                <input
                  id="sub-desde"
                  type="date"
                  className="input"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </Field>
              <button type="submit" disabled={asignando} className="btn-primary w-full">
                {asignando ? <Spinner /> : 'Asignar plan'}
              </button>
            </>
          )}
        </form>
      </div>
    </Modal>
  )
}
