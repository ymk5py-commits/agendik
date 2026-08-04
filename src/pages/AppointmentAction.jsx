import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Check, Clock, User, X } from 'lucide-react'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import { Logo } from '../components/Logo'
import { PageLoader, Spinner } from '../components/ui'
import { formatLongDate } from '../utils/format'
import { statusMeta } from '../utils/appointments'

export default function AppointmentAction() {
  const { token } = useParams()
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [done, setDone] = useState(null)

  const query = useAsync(() => backend.getAppointmentByToken(token), [token])

  // El token es la credencial: la acción se resuelve en el backend sin sesión.
  const act = async (kind) => {
    setBusy(kind)
    setActionError(null)
    try {
      const { status } = await backend.actOnAppointmentByToken(token, kind)
      query.setData((prev) => ({ ...prev, appointment: { ...prev.appointment, status } }))
      setDone(kind)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-sand-50">
      <header className="border-b border-sand-200 bg-white">
        <div className="container-app flex h-16 items-center">
          <Link to="/" className="rounded-lg">
            <Logo subtitle="Portal del cliente" />
          </Link>
        </div>
      </header>

      <main className="container-app flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          {query.loading ? (
            <PageLoader label="Abriendo tu cita…" />
          ) : query.error ? (
            <div className="card text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="mt-4 font-display text-xl font-bold text-sand-900">{query.error}</h1>
              <p className="mt-1.5 text-sm text-sand-500">
                Puede que el link haya vencido o que ya lo hayas usado. Entrá a tu cuenta para ver el estado real.
              </p>
              <Link to="/ingresar" className="btn-primary mt-5">
                Ir a mi cuenta
              </Link>
            </div>
          ) : (
            <AppointmentPanel
              data={query.data}
              busy={busy}
              done={done}
              error={actionError}
              onConfirm={() => act('confirm')}
              onCancel={() => act('cancel')}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function AppointmentPanel({ data, busy, done, error, onConfirm, onCancel }) {
  const { appointment, clientName, business } = data
  const meta = statusMeta(appointment.status)
  const closed = ['cancelled', 'completed'].includes(appointment.status)

  return (
    <div className="card">
      {done ? (
        <div className="text-center">
          <span
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
              done === 'confirm' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {done === 'confirm' ? <Check className="h-6 w-6" aria-hidden="true" /> : <X className="h-6 w-6" aria-hidden="true" />}
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-sand-900">
            {done === 'confirm' ? '¡Cita confirmada!' : 'Cita cancelada'}
          </h1>
          <p className="mt-1.5 text-sm text-sand-500">
            {done === 'confirm'
              ? `Te esperamos en ${business}.`
              : 'Avisamos al local. Podés reservar otra cuando quieras.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-sand-500">Hola {clientName?.split(' ')[0]}, esta es tu cita en</p>
          <h1 className="font-display text-xl font-bold text-sand-900">{business}</h1>
        </>
      )}

      <div className="mt-5 rounded-2xl bg-sand-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-base font-bold text-sand-900">
            {appointment.services?.map((s) => s.name).join(' + ')}
          </p>
          <span className={`chip ${meta.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            {meta.label}
          </span>
        </div>

        <dl className="mt-3 space-y-1.5 text-sm text-sand-600">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Fecha</dt>
            <CalendarDays className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <dd className="first-letter:uppercase">{formatLongDate(appointment.date)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Horario</dt>
            <Clock className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <dd className="tabular">
              {appointment.startTime} – {appointment.endTime}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Profesional</dt>
            <User className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <dd>{appointment.professional?.name}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}

      {!done && !closed && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onCancel} disabled={Boolean(busy)} className="btn-outline flex-1 py-3">
            {busy === 'cancel' ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" aria-hidden="true" />}
            {busy === 'cancel' ? 'Cancelando…' : 'No puedo ir'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={Boolean(busy) || appointment.status === 'confirmed'}
            className="btn-primary flex-1 py-3"
          >
            {busy === 'confirm' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {appointment.status === 'confirmed' ? 'Ya confirmaste' : busy === 'confirm' ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      )}

      <div className="mt-5 border-t border-sand-200 pt-4 text-center">
        <Link
          to="/ingresar"
          className="rounded-lg text-sm font-semibold text-primary-700 transition-colors hover:text-primary-900"
        >
          Ver todas mis citas
        </Link>
      </div>
    </div>
  )
}
