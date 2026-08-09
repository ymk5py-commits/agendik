import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { ArrowRight } from 'lucide-react'
import { backend } from '../../api/backend'
import { useAsync } from '../../hooks/useAsync'
import { Field, Modal, Spinner } from '../ui'
import { formatDuration } from '../../utils/format'

/**
 * Mueve una cita a otro día, hora o profesional.
 *
 * Los servicios no se tocan, así que la duración es la misma y solo hay que
 * elegir un hueco que la aguante. Si el destino choca, lo frena Postgres.
 */
export default function RescheduleModal({ cita, onClose, onDone }) {
  const [profesionalId, setProfesionalId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [guardando, setGuardando] = useState(false)

  const profesionales = useAsync(() => (cita ? backend.getProfessionals() : Promise.resolve([])), [cita?.id], {
    initialData: [],
  })

  useEffect(() => {
    if (!cita) return
    setProfesionalId(cita.professionalId)
    setFecha(cita.date)
    setHora('')
  }, [cita])

  const disponibles = useAsync(
    () =>
      cita && profesionalId && fecha
        ? backend.getAvailability({ professionalId: profesionalId, dateKey: fecha, durationMin: cita.durationMin })
        : Promise.resolve([]),
    [cita?.id, profesionalId, fecha],
    { initialData: [] },
  )

  // El hueco que ocupa la propia cita no aparece como libre; si no se movió de
  // día ni de profesional, se lo agrega para poder dejarlo donde estaba.
  const horarios = (() => {
    const libres = disponibles.data || []
    if (!cita) return libres
    const mismoLugar = profesionalId === cita.professionalId && fecha === cita.date
    if (mismoLugar && !libres.includes(cita.startTime)) {
      return [...libres, cita.startTime].sort()
    }
    return libres
  })()

  const guardar = async () => {
    if (!hora) return
    setGuardando(true)
    try {
      await backend.rescheduleAppointment(cita.id, {
        date: fecha,
        startTime: hora,
        professionalId: profesionalId,
        durationMin: cita.durationMin,
      })
      toast.success('Cita reprogramada.')
      onDone?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'No pudimos reprogramar la cita.')
    } finally {
      setGuardando(false)
    }
  }

  const cambio = cita && (fecha !== cita.date || hora !== cita.startTime || profesionalId !== cita.professionalId)

  return (
    <Modal
      open={Boolean(cita)}
      onClose={onClose}
      title="Reprogramar cita"
      description={cita ? `${cita.clientName} · ${cita.servicesLabel}` : undefined}
    >
      {cita && (
        <div className="space-y-4">
          <div className="rounded-xl bg-sand-100 px-3.5 py-3 text-sm">
            <p className="font-medium text-sand-800">Ahora está en</p>
            <p className="mt-0.5 text-sand-600">
              {format(parseISO(cita.date), "EEEE d 'de' MMMM", { locale: es })} ·{' '}
              <span className="tabular">
                {cita.startTime}–{cita.endTime}
              </span>{' '}
              · {cita.professionalName}
            </p>
            <p className="mt-0.5 text-xs text-sand-500">Dura {formatDuration(cita.durationMin)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Profesional" htmlFor="re-prof">
              <select
                id="re-prof"
                className="input"
                value={profesionalId}
                onChange={(e) => {
                  setProfesionalId(e.target.value)
                  setHora('')
                }}
              >
                {(profesionales.data || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Día" htmlFor="re-fecha">
              <input
                id="re-fecha"
                type="date"
                className="input"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value)
                  setHora('')
                }}
              />
            </Field>
          </div>

          <Field
            label="Nueva hora"
            htmlFor="re-hora"
            required
            hint={
              disponibles.loading
                ? 'Buscando huecos…'
                : horarios.length === 0
                  ? 'Ese día no le entra una cita de esta duración.'
                  : undefined
            }
          >
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
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

          {hora && cambio && (
            <p className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-50 px-3.5 py-2.5 text-sm text-primary-900">
              <span className="tabular">
                {format(parseISO(cita.date), 'd MMM', { locale: es })} {cita.startTime}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="tabular font-semibold">
                {format(parseISO(fecha), 'd MMM', { locale: es })} {hora}
              </span>
            </p>
          )}

          <p className="rounded-xl bg-accent-50 px-3.5 py-2.5 text-xs text-accent-900">
            Al cliente no le llega aviso automático: si la movés, contale vos.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={!hora || !cambio || guardando} className="btn-primary">
              {guardando && <Spinner className="h-4 w-4" />}
              Reprogramar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
