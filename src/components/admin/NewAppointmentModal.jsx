import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../../api/backend'
import { useAsync } from '../../hooks/useAsync'
import { Field, Modal, Spinner } from '../ui'
import { formatDuration, formatGs, toDateKey } from '../../utils/format'

/**
 * Alta de cita desde el mostrador o el teléfono.
 *
 * A diferencia del portal, acá se puede elegir cualquier horario libre del
 * profesional y queda confirmada de entrada: si el negocio la carga, es
 * porque ya la acordó con la persona.
 */
export default function NewAppointmentModal({ open, onClose, onCreated, tenantId }) {
  const [clienteId, setClienteId] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [serviciosElegidos, setServiciosElegidos] = useState([])
  const [fecha, setFecha] = useState(toDateKey(new Date()))
  const [hora, setHora] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const clientes = useAsync(() => (open ? backend.getAdminClients() : Promise.resolve([])), [open], {
    initialData: [],
  })
  const profesionales = useAsync(() => (open ? backend.getProfessionals() : Promise.resolve([])), [open], {
    initialData: [],
  })
  const servicios = useAsync(() => (open ? backend.getServices() : Promise.resolve([])), [open], {
    initialData: [],
  })

  const duracion = useMemo(
    () =>
      (servicios.data || [])
        .filter((s) => serviciosElegidos.includes(s.id))
        .reduce((acc, s) => acc + s.durationMin, 0),
    [servicios.data, serviciosElegidos],
  )

  const total = useMemo(
    () =>
      (servicios.data || [])
        .filter((s) => serviciosElegidos.includes(s.id))
        .reduce((acc, s) => acc + s.price, 0),
    [servicios.data, serviciosElegidos],
  )

  // Los horarios libres se recalculan al cambiar profesional, día o duración.
  const disponibles = useAsync(
    () =>
      profesionalId && fecha && duracion
        ? backend.getAvailability({ professionalId: profesionalId, dateKey: fecha, durationMin: duracion })
        : Promise.resolve([]),
    [profesionalId, fecha, duracion],
    { initialData: [] },
  )

  useEffect(() => {
    if (!open) {
      setClienteId('')
      setProfesionalId('')
      setServiciosElegidos([])
      setFecha(toDateKey(new Date()))
      setHora('')
      setNotas('')
    }
  }, [open])

  // Si cambia la disponibilidad y la hora elegida ya no existe, se limpia.
  useEffect(() => {
    if (hora && !(disponibles.data || []).includes(hora)) setHora('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponibles.data])

  const toggleServicio = (id) =>
    setServiciosElegidos((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))

  const listo = clienteId && profesionalId && serviciosElegidos.length > 0 && fecha && hora

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!listo) return
    setGuardando(true)
    try {
      await backend.createAppointmentForClient({
        tenantId,
        clientId: clienteId,
        professionalId: profesionalId,
        serviceIds: serviciosElegidos,
        date: fecha,
        startTime: hora,
        notes: notas,
      })
      toast.success('Cita agendada.')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos crear la cita.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva cita"
      description="Para reservas que entran por teléfono, WhatsApp o mostrador."
    >
      <form onSubmit={guardar} className="space-y-4">
        <Field label="Cliente" htmlFor="cita-cliente" required>
          <select
            id="cita-cliente"
            className="input"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Elegí un cliente…</option>
            {(clientes.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `· ${c.phone}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Servicios" htmlFor="cita-servicios" required>
          <div id="cita-servicios" className="flex flex-wrap gap-2">
            {(servicios.data || []).map((s) => {
              const activo = serviciosElegidos.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleServicio(s.id)}
                  aria-pressed={activo}
                  className={`chip cursor-pointer border transition-colors ${
                    activo
                      ? 'border-primary-700 bg-primary-800 text-white'
                      : 'border-sand-200 bg-white text-sand-700 hover:border-primary-300'
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </Field>

        {duracion > 0 && (
          <p className="rounded-xl bg-sand-100 px-3 py-2 text-sm text-sand-700">
            {formatDuration(duracion)} · <span className="tabular font-semibold">{formatGs(total)}</span>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Profesional" htmlFor="cita-prof" required>
            <select
              id="cita-prof"
              className="input"
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
            >
              <option value="">Elegí…</option>
              {(profesionales.data || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Día" htmlFor="cita-fecha" required>
            <input
              id="cita-fecha"
              type="date"
              className="input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Hora"
          htmlFor="cita-hora"
          required
          hint={
            !profesionalId || !duracion
              ? 'Elegí servicios y profesional para ver los horarios libres.'
              : disponibles.loading
                ? 'Buscando horarios…'
                : (disponibles.data || []).length === 0
                  ? 'Ese día no le quedan huecos libres a este profesional.'
                  : undefined
          }
        >
          <div className="flex flex-wrap gap-2">
            {(disponibles.data || []).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                aria-pressed={hora === h}
                className={`tabular chip cursor-pointer border transition-colors ${
                  hora === h
                    ? 'border-primary-700 bg-primary-800 text-white'
                    : 'border-sand-200 bg-white text-sand-700 hover:border-primary-300'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Nota" htmlFor="cita-notas" hint="Opcional, la ve solo el equipo.">
          <input
            id="cita-notas"
            className="input"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Pidió que la atienda Valeria"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={!listo || guardando} className="btn-primary">
            {guardando && <Spinner className="h-4 w-4" />}
            Agendar
          </button>
        </div>
      </form>
    </Modal>
  )
}
