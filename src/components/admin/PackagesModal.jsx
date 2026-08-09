import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Layers, Minus, Plus, X } from 'lucide-react'
import { backend } from '../../api/backend'
import { useAsync } from '../../hooks/useAsync'
import { EmptyState, Field, Modal, Skeleton, Spinner } from '../ui'
import { formatGs } from '../../utils/format'

/**
 * Paquetes de un cliente: los que tiene y el alta de uno nuevo.
 *
 * Los importes no se escriben a mano: salen del precio real de cada servicio
 * por la cantidad de sesiones, menos el descuento. Así no hay forma de que el
 * total no cierre con el catálogo.
 */
export default function PackagesModal({ cliente, tenantId, onClose, onChanged }) {
  const [creando, setCreando] = useState(false)

  const paquetes = useAsync(
    () => (cliente ? backend.getPackages(cliente.id) : Promise.resolve([])),
    [cliente?.id],
    { initialData: [] },
  )

  useEffect(() => {
    if (!cliente) setCreando(false)
  }, [cliente])

  const cerrarPaquete = async (paquete, status) => {
    try {
      await backend.setPackageStatus(paquete.id, status)
      toast.success(status === 'completed' ? 'Paquete cerrado.' : 'Paquete cancelado.')
      paquetes.reload()
      onChanged?.()
    } catch (err) {
      toast.error(err.message || 'No pudimos cambiar el paquete.')
    }
  }

  return (
    <Modal
      open={Boolean(cliente)}
      onClose={onClose}
      title={`Paquetes de ${cliente?.name || ''}`}
      description="Sesiones prepagas. El cliente las usa al reservar y se descuentan solas."
    >
      {creando ? (
        <FormularioPaquete
          tenantId={tenantId}
          clienteId={cliente?.id}
          onCancel={() => setCreando(false)}
          onSaved={() => {
            setCreando(false)
            paquetes.reload()
            onChanged?.()
          }}
        />
      ) : (
        <div className="space-y-4">
          {paquetes.loading && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!paquetes.loading && (paquetes.data || []).length === 0 && (
            <EmptyState
              icon={Layers}
              title="Todavía no tiene paquetes"
              description="Armale uno con las sesiones que contrató."
            />
          )}

          <ul className="space-y-3">
            {(paquetes.data || []).map((p) => (
              <li key={p.id} className="rounded-xl border border-sand-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sand-900">{p.name}</p>
                    <span
                      className={`chip mt-1 ${
                        p.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : p.status === 'completed'
                            ? 'bg-sand-100 text-sand-600'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {p.status === 'active' ? 'Activo' : p.status === 'completed' ? 'Cerrado' : 'Cancelado'}
                    </span>
                  </div>
                  {p.status === 'active' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => cerrarPaquete(p, 'completed')}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => cerrarPaquete(p, 'cancelled')}
                        className="btn-ghost px-2 py-1 text-xs text-rose-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <ul className="mt-2.5 space-y-1 text-sm">
                  {p.items.map((i) => (
                    <li key={i.serviceId} className="flex justify-between gap-3">
                      <span className="text-sand-700">{i.service?.name || 'Servicio'}</span>
                      <span className="tabular shrink-0 font-medium text-sand-900">
                        {i.quantity - i.sessionsUsed} de {i.quantity}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-2.5 space-y-0.5 border-t border-sand-200 pt-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-sand-500">Precio</dt>
                    <dd className="tabular text-sand-900">{formatGs(p.finalPrice)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sand-500">Pagado</dt>
                    <dd className="tabular text-emerald-700">{formatGs(p.totalPaid)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt className="text-sand-600">Saldo</dt>
                    <dd className={`tabular ${p.remainingBalance > 0 ? 'text-rose-700' : 'text-sand-900'}`}>
                      {formatGs(p.remainingBalance)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline">
              Cerrar
            </button>
            <button type="button" onClick={() => setCreando(true)} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo paquete
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function FormularioPaquete({ tenantId, clienteId, onCancel, onSaved }) {
  const [nombre, setNombre] = useState('')
  const [items, setItems] = useState({})
  const [descuento, setDescuento] = useState(0)
  const [pagado, setPagado] = useState(0)
  const [guardando, setGuardando] = useState(false)

  const servicios = useAsync(() => backend.getServices(), [], { initialData: [] })

  const elegidos = useMemo(
    () => (servicios.data || []).filter((s) => items[s.id] > 0),
    [servicios.data, items],
  )

  const original = elegidos.reduce((acc, s) => acc + s.price * items[s.id], 0)
  const montoDescuento = Math.round((original * Number(descuento || 0)) / 100)
  const final = original - montoDescuento
  const saldo = final - Number(pagado || 0)

  const cambiar = (id, delta) =>
    setItems((prev) => {
      const nuevo = Math.max(0, (prev[id] || 0) + delta)
      const copia = { ...prev }
      if (nuevo === 0) delete copia[id]
      else copia[id] = nuevo
      return copia
    })

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!nombre.trim()) return toast.error('Ponele un nombre al paquete.')
    if (elegidos.length === 0) return toast.error('Agregá al menos un servicio.')

    setGuardando(true)
    try {
      await backend.savePackage({
        tenantId,
        clientId: clienteId,
        name: nombre,
        items: elegidos.map((s) => ({ serviceId: s.id, quantity: items[s.id] })),
        discountPercentage: descuento,
        totalPaid: pagado,
      })
      toast.success('Paquete creado.')
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'No pudimos crear el paquete.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
      <Field label="Nombre del paquete" htmlFor="pack-nombre" required>
        <input
          id="pack-nombre"
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Pack Facial Glow"
        />
      </Field>

      <Field label="Sesiones" htmlFor="pack-items" required hint="Cuántas de cada servicio incluye.">
        <ul id="pack-items" className="space-y-1.5">
          {(servicios.data || []).map((s) => {
            const cantidad = items[s.id] || 0
            return (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                  cantidad > 0 ? 'border-primary-200 bg-primary-50/40' : 'border-sand-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sand-800">{s.name}</p>
                  <p className="tabular text-xs text-sand-500">{formatGs(s.price)} c/u</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cambiar(s.id, -1)}
                    disabled={cantidad === 0}
                    aria-label={`Quitar una sesión de ${s.name}`}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-sand-200 text-sand-600 transition-colors hover:border-primary-300 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="tabular w-6 text-center text-sm font-semibold text-sand-900">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => cambiar(s.id, 1)}
                    aria-label={`Agregar una sesión de ${s.name}`}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-sand-200 text-sand-600 transition-colors hover:border-primary-300"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descuento (%)" htmlFor="pack-desc">
          <input
            id="pack-desc"
            type="number"
            min="0"
            max="100"
            className="input"
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
          />
        </Field>
        <Field label="Ya pagó (Gs.)" htmlFor="pack-pagado">
          <input
            id="pack-pagado"
            type="number"
            min="0"
            step="10000"
            className="input"
            value={pagado}
            onChange={(e) => setPagado(e.target.value)}
          />
        </Field>
      </div>

      {original > 0 && (
        <dl className="space-y-1 rounded-xl bg-sand-100 px-3.5 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-sand-600">Precio de lista</dt>
            <dd className="tabular text-sand-900">{formatGs(original)}</dd>
          </div>
          {montoDescuento > 0 && (
            <div className="flex justify-between">
              <dt className="text-sand-600">Descuento {descuento}%</dt>
              <dd className="tabular text-emerald-700">− {formatGs(montoDescuento)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-sand-300 pt-1 font-semibold">
            <dt className="text-sand-700">Total</dt>
            <dd className="tabular text-sand-900">{formatGs(final)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sand-600">Saldo</dt>
            <dd className={`tabular font-semibold ${saldo > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {formatGs(saldo)}
            </dd>
          </div>
        </dl>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-outline">
          <X className="h-4 w-4" aria-hidden="true" />
          Volver
        </button>
        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando && <Spinner className="h-4 w-4" />}
          Crear paquete
        </button>
      </div>
    </form>
  )
}
