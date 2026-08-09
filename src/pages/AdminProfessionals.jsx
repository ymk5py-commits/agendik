import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Clock, Pencil, Plus, RotateCcw, Trash2, UserCog } from 'lucide-react'
import { backend } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { EmptyState, ErrorState, Field, Modal, Skeleton, Spinner } from '../components/ui'

// El índice coincide con getDay() de JavaScript, que es lo que usa el
// cálculo de horarios libres. Domingo primero.
const DIAS = [
  { id: 1, label: 'Lunes', corto: 'Lun' },
  { id: 2, label: 'Martes', corto: 'Mar' },
  { id: 3, label: 'Miércoles', corto: 'Mié' },
  { id: 4, label: 'Jueves', corto: 'Jue' },
  { id: 5, label: 'Viernes', corto: 'Vie' },
  { id: 6, label: 'Sábado', corto: 'Sáb' },
  { id: 0, label: 'Domingo', corto: 'Dom' },
]

export default function AdminProfessionals() {
  const { staff } = useAuth()
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [horariosDe, setHorariosDe] = useState(null)

  const profesionales = useAsync(() => backend.getProfessionals({ todos: true }), [], { initialData: [] })
  const lista = profesionales.data || []

  const cambiarEstado = async (pro) => {
    try {
      await backend.setProfessionalActive(pro.id, !pro.active)
      toast.success(pro.active ? `${pro.name} dado de baja.` : `${pro.name} reactivado.`)
      profesionales.reload()
    } catch (err) {
      toast.error(err.message || 'No pudimos cambiar el profesional.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sand-900 sm:text-3xl">Profesionales</h1>
          <p className="mt-1 text-sm text-sand-600">
            Quiénes atienden y en qué horarios. De acá salen los huecos que ve el cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditando(null)
            setAbierto(true)
          }}
          className="btn-accent"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo profesional
        </button>
      </header>

      {profesionales.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {profesionales.error && <ErrorState message={profesionales.error} onRetry={profesionales.reload} />}

      {!profesionales.loading && !profesionales.error && lista.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="Todavía no hay profesionales"
          description="Sin profesionales no hay agenda que mostrar."
        />
      )}

      <ul className="space-y-2.5">
        {lista.map((p) => (
          <li key={p.id} className={`card flex flex-wrap items-center gap-4 p-4 sm:p-4 ${p.active ? '' : 'opacity-60'}`}>
            <div className="min-w-[10rem] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sand-900">{p.name}</span>
                {!p.active && <span className="chip bg-sand-100 text-sand-600">Dado de baja</span>}
              </div>
              <p className="mt-0.5 text-sm text-sand-500">
                {p.specialties.length > 0 ? p.specialties.join(' · ') : 'Sin especialidades cargadas'}
              </p>
            </div>

            <span className="text-xs text-sand-500">Turnos cada {p.slotIntervalMin} min</span>

            <div className="flex gap-1">
              <button type="button" onClick={() => setHorariosDe(p)} className="btn-outline px-3 py-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Horarios</span>
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
              <button
                type="button"
                onClick={() => cambiarEstado(p)}
                aria-label={p.active ? `Dar de baja ${p.name}` : `Reactivar ${p.name}`}
                className={p.active ? 'btn-ghost px-2.5 text-rose-700' : 'btn-ghost px-2.5 text-emerald-700'}
              >
                {p.active ? (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ProfessionalModal
        open={abierto}
        onClose={() => setAbierto(false)}
        onSaved={() => profesionales.reload()}
        tenantId={staff?.tenantId}
        profesional={editando}
      />

      <WorkingHoursModal
        profesional={horariosDe}
        onClose={() => setHorariosDe(null)}
      />
    </div>
  )
}

function ProfessionalModal({ open, onClose, onSaved, tenantId, profesional }) {
  const editando = Boolean(profesional)
  const [form, setForm] = useState({ name: '', specialties: '', slotIntervalMin: 30 })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [abiertoAntes, setAbiertoAntes] = useState(false)
  if (open !== abiertoAntes) {
    setAbiertoAntes(open)
    if (open) {
      setError('')
      setForm(
        profesional
          ? {
              name: profesional.name,
              specialties: profesional.specialties.join(', '),
              slotIntervalMin: profesional.slotIntervalMin,
            }
          : { name: '', specialties: '', slotIntervalMin: 30 },
      )
    }
  }

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!form.name.trim()) {
      setError('Poné el nombre.')
      return
    }
    setGuardando(true)
    try {
      await backend.saveProfessional({
        id: profesional?.id,
        tenantId,
        name: form.name,
        specialties: form.specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        slotIntervalMin: form.slotIntervalMin,
      })
      toast.success(editando ? 'Profesional actualizado.' : 'Profesional creado.')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar profesional' : 'Nuevo profesional'}
      description={editando ? undefined : 'Después cargale los horarios para que aparezca en la reserva.'}
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Field label="Nombre y apellido" htmlFor="pro-nombre" required error={error}>
          <input
            id="pro-nombre"
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Valeria Núñez"
          />
        </Field>

        <Field label="Especialidades" htmlFor="pro-esp" hint="Separadas por coma.">
          <input
            id="pro-esp"
            className="input"
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            placeholder="Faciales, Depilación"
          />
        </Field>

        <Field
          label="Cada cuánto arranca un turno"
          htmlFor="pro-slot"
          hint="En minutos. Con 30, los turnos empiezan 09:00, 09:30, 10:00…"
        >
          <select
            id="pro-slot"
            className="input"
            value={form.slotIntervalMin}
            onChange={(e) => setForm((f) => ({ ...f, slotIntervalMin: e.target.value }))}
          >
            {[10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutos
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando && <Spinner className="h-4 w-4" />}
            {editando ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function WorkingHoursModal({ profesional, onClose }) {
  const [dias, setDias] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!profesional) return
    let vivo = true
    setCargando(true)
    backend
      .getWorkingHours(profesional.id)
      .then((rangos) => {
        if (!vivo) return
        const mapa = {}
        for (const r of rangos) mapa[r.weekday] = { start: r.start, end: r.end }
        setDias(mapa)
      })
      .catch((err) => toast.error(err.message || 'No pudimos cargar los horarios.'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [profesional])

  const toggleDia = (id) =>
    setDias((prev) => {
      const copia = { ...prev }
      if (copia[id]) delete copia[id]
      else copia[id] = { start: '09:00', end: '18:00' }
      return copia
    })

  const setHora = (id, campo, valor) =>
    setDias((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))

  const invalidos = useMemo(
    () => Object.entries(dias).filter(([, r]) => r.start && r.end && r.start >= r.end).map(([id]) => Number(id)),
    [dias],
  )

  const guardar = async () => {
    if (invalidos.length > 0) return
    setGuardando(true)
    try {
      const rangos = Object.entries(dias).map(([weekday, r]) => ({
        weekday: Number(weekday),
        start: r.start,
        end: r.end,
      }))
      await backend.saveWorkingHours(profesional.id, rangos)
      toast.success('Horarios guardados.')
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar los horarios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={Boolean(profesional)}
      onClose={onClose}
      title={`Horarios de ${profesional?.name || ''}`}
      description="Marcá los días que atiende. De acá salen los huecos que ve el cliente al reservar."
    >
      {cargando ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {DIAS.map((d) => {
            const activo = Boolean(dias[d.id])
            const malRango = invalidos.includes(d.id)
            return (
              <div
                key={d.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                  malRango ? 'border-rose-300 bg-rose-50' : activo ? 'border-primary-200 bg-primary-50/40' : 'border-sand-200'
                }`}
              >
                <label className="flex min-w-[7rem] cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-800">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => toggleDia(d.id)}
                    className="h-4 w-4 cursor-pointer rounded border-sand-300 text-primary-700 focus:ring-primary-500"
                  />
                  {d.label}
                </label>

                {activo ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`Hora de entrada, ${d.label}`}
                      className="input tabular w-auto py-1.5"
                      value={dias[d.id].start}
                      onChange={(e) => setHora(d.id, 'start', e.target.value)}
                    />
                    <span className="text-sand-400">a</span>
                    <input
                      type="time"
                      aria-label={`Hora de salida, ${d.label}`}
                      className="input tabular w-auto py-1.5"
                      value={dias[d.id].end}
                      onChange={(e) => setHora(d.id, 'end', e.target.value)}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-sand-400">No atiende</span>
                )}

                {malRango && (
                  <span role="alert" className="text-xs font-medium text-rose-700">
                    La salida tiene que ser después de la entrada.
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 rounded-xl bg-accent-50 px-3.5 py-2.5 text-xs text-accent-900">
        Cambiar los horarios no mueve las citas ya agendadas. Si achicás un día, las que
        queden fuera del rango siguen en la agenda y hay que reprogramarlas a mano.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-outline">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || cargando || invalidos.length > 0}
          className="btn-primary"
        >
          {guardando && <Spinner className="h-4 w-4" />}
          Guardar horarios
        </button>
      </div>
    </Modal>
  )
}
