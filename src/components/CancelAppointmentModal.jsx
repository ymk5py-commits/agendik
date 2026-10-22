import { useState } from 'react'
import toast from 'react-hot-toast'
import { backend } from '../api/backend'
import { ErrorBanner, Modal, Spinner } from './ui'
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
      <div className="rounded-xl bg-sand-100 p-4">
        <p className="font-display text-base font-bold text-primary-950">
          {appointment.services?.map((s) => s.name).join(' + ')}
        </p>
        <p className="mt-1 text-base text-sand-800 first-letter:uppercase">{formatLongDate(appointment.date)}</p>
        <p className="tabular text-base text-sand-800">
          {appointment.startTime} a {appointment.endTime} · {appointment.professional?.name}
        </p>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
    </Modal>
  )
}
