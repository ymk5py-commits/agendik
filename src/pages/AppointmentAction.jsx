import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, Check, Clock, User, X } from 'lucide-react'
import { backend } from '../api/backend'
import { useAsync } from '../hooks/useAsync'
import { Logo } from '../components/Logo'
import { ErrorBanner, PageLoader, Spinner } from '../components/ui'
import { formatDayParts, formatLongDate } from '../utils/format'
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
      <header className="border-b border-sand-300 bg-white">
        <div className="container-app flex h-16 items-center">
          <Link to="/" className="rounded-lg">
            <Logo subtitle="Portal de citas" />
          </Link>
        </div>
      </header>

      <main className="container-app flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          {query.loading ? (
            <PageLoader label="Abriendo tu cita…" />
          ) : query.error ? (
            <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-800">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold">{query.error}</h1>
              <p className="mt-2 text-base text-sand-700">
                Puede que el link haya vencido o que ya lo hayas usado. Entrá a tu cuenta para ver el estado real.
              </p>
              <Link to="/ingresar" className="btn-primary btn-lg mt-6">
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
  const { weekday, day, month } = formatDayParts(appointment.date)

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft sm:p-8">
      {done ? (
        <div>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              done === 'confirm' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {done === 'confirm' ? <Check className="h-6 w-6" aria-hidden="true" /> : <X className="h-6 w-6" aria-hidden="true" />}
          </span>
          <h1 role="status" className="mt-4 font-display text-3xl font-extrabold">
            {done === 'confirm' ? 'Cita confirmada' : 'Cita cancelada'}
          </h1>
          <p className="mt-2 text-base text-sand-700">
            {done === 'confirm'
              ? `Te esperamos en ${business}.`
              : 'Avisamos al local. Podés reservar otra cuando quieras.'}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-base text-sand-700">Hola {clientName?.split(' ')[0]}, esta es tu cita en</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight">{business}</h1>
        </div>
      )}

      <div className="mt-6 flex gap-4 rounded-2xl bg-sand-100 p-4">
        <div
          aria-hidden="true"
          className={`flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl py-3 ${
            closed ? 'bg-white text-sand-700' : 'bg-primary-800 text-white'
          }`}
        >
          <span className="text-[0.8125rem] font-medium capitalize leading-tight">{weekday}</span>
          <span className="tabular font-display text-3xl font-extrabold leading-none">{day}</span>
          <span className="text-[0.8125rem] font-medium capitalize leading-tight">{month}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="font-display text-lg font-bold leading-snug text-primary-950">
              {appointment.services?.map((s) => s.name).join(' + ')}
            </p>
            <span className={`chip ${meta.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
              {meta.label}
            </span>
          </div>

          <dl className="mt-2 space-y-1.5 text-base text-sand-800">
            <div className="sr-only">
              <dt>Fecha</dt>
              <dd>{formatLongDate(appointment.date)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Horario</dt>
              <Clock className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <dd className="tabular">
                {appointment.startTime} a {appointment.endTime}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Profesional</dt>
              <User className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <dd>{appointment.professional?.name}</dd>
            </div>
          </dl>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      {!done && !closed && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onCancel} disabled={Boolean(busy)} className="btn-outline btn-lg flex-1">
            {busy === 'cancel' ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" aria-hidden="true" />}
            {busy === 'cancel' ? 'Cancelando…' : 'No puedo ir'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={Boolean(busy) || appointment.status === 'confirmed'}
            className="btn-primary btn-lg flex-1"
          >
            {busy === 'confirm' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {appointment.status === 'confirmed' ? 'Ya confirmaste' : busy === 'confirm' ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-sand-200 pt-4">
        <Link
          to="/ingresar"
          className="inline-flex min-h-[44px] items-center rounded-lg text-base font-semibold text-primary-800 underline decoration-primary-300 underline-offset-4 transition-colors hover:decoration-primary-700"
        >
          Ver todas mis citas
        </Link>
      </div>
    </div>
  )
}
