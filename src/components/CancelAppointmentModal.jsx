import { useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../api/backend'
import { Modal, Spinner } from './ui'
import { formatLongDate } from '../utils/format'

export default function CancelAppointmentModal({ appointment, onClose, onCancelled }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const updated = await backend.cancelAppointment(appointment.id)
      toast.success('Cita cancelada.')
      onCancelled(updated)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={submitting ? () => {} : onClose}
      title="¿Cancelar esta cita?"
      description="Si tu cita usaba una sesión de un paquete, te la devolvemos."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-outline">
            Mantener la cita
          </button>
          <button type="button" onClick={confirm} disabled={submitting} className="btn-danger">
            {submitting ? <Spinner className="h-4 w-4" /> : null}
            {submitting ? 'Cancelando…' : 'Sí, cancelar'}
          </button>
        </>
      }
    >
      <div className="rounded-xl bg-sand-50 p-4">
        <p className="font-display text-sm font-bold text-sand-900">
          {appointment.services?.map((s) => s.name).join(' + ')}
        </p>
        <p className="mt-1 text-sm text-sand-600 first-letter:uppercase">{formatLongDate(appointment.date)}</p>
        <p className="text-sm tabular text-sand-600">
          {appointment.startTime} – {appointment.endTime} · {appointment.professional?.name}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}
    </Modal>
  )
}
