import { Component, Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TenantProvider } from './context/TenantContext'
import { DEFAULT_TENANT } from './api/supabaseClient'
import AppLayout from './components/layout/AppLayout'
import { PageLoader } from './components/ui'
import Landing from './pages/Landing'

const FLAG_RECARGA = 'agendik:chunk-recargado'

/**
 * Igual que lazy(), pero se recupera de un deploy hecho con la app abierta.
 *
 * Cada build renombra los chunks con un hash nuevo. Una pestaña que quedó
 * abierta desde antes pide el nombre viejo, que ya no existe, y el import
 * falla: sin esto la pantalla queda rota hasta que el usuario recargue a
 * mano. Recargamos una sola vez —el flag evita el bucle si el fallo es
 * otro— y se limpia en cuanto un chunk carga bien.
 */
function lazyPagina(cargar) {
  return lazy(() =>
    cargar()
      .then((modulo) => {
        sessionStorage.removeItem(FLAG_RECARGA)
        return modulo
      })
      .catch((error) => {
        if (!sessionStorage.getItem(FLAG_RECARGA)) {
          sessionStorage.setItem(FLAG_RECARGA, '1')
          window.location.reload()
          // Nunca resuelve: la página se está recargando.
          return new Promise(() => {})
        }
        throw error
      }),
  )
}

// La landing entra en el bundle inicial; el resto se carga al navegar.
const Login = lazyPagina(() => import('./pages/Login'))
const AdminBusinesses = lazyPagina(() => import('./pages/AdminBusinesses'))
const ResetPassword = lazyPagina(() => import('./pages/ResetPassword'))
const AdminPlans = lazyPagina(() => import('./pages/AdminPlans'))
const Dashboard = lazyPagina(() => import('./pages/Dashboard'))
const BookAppointment = lazyPagina(() => import('./pages/BookAppointment'))
const MyAppointments = lazyPagina(() => import('./pages/MyAppointments'))
const Profile = lazyPagina(() => import('./pages/Profile'))
const AppointmentAction = lazyPagina(() => import('./pages/AppointmentAction'))
const AdminAgenda = lazyPagina(() => import('./pages/AdminAgenda'))
const AdminClients = lazyPagina(() => import('./pages/AdminClients'))
const AdminProfile = lazyPagina(() => import('./pages/AdminProfile'))
const AdminServices = lazyPagina(() => import('./pages/AdminServices'))
const AdminProfessionals = lazyPagina(() => import('./pages/AdminProfessionals'))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-sand-50 px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-sand-900">Algo se rompió de nuestro lado</h1>
        <p className="max-w-md text-sm text-sand-600">
          Recargá la página para volver a intentarlo. Si el problema sigue, escribinos y lo revisamos.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          Recargar
        </button>
      </div>
    )
  }
}

function ScrollToTop() {
  const { pathname } = useLocation()
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
  return null
}

/** Pantallas del portal: exigen ficha de cliente. El equipo va a su agenda. */
function ClientRoute({ children }) {
  const { isAuthenticated, isStaff, loading } = useAuth()
  if (loading) return <PageLoader label="Verificando tu sesión…" />
  if (!isAuthenticated) return <Navigate to="/ingresar" replace />
  if (isStaff) return <Navigate to="/agenda" replace />
  return <AppLayout>{children}</AppLayout>
}

/**
 * Pantalla de la plataforma: exige ser el dueño de la plataforma.
 *
 * Igual que con el resto, esto solo decide qué se dibuja: quién puede leer o
 * crear negocios de verdad lo deciden las funciones en Postgres.
 */
function PlatformRoute({ children }) {
  const { isAuthenticated, isPlatformAdmin, loading } = useAuth()
  if (loading) return <PageLoader label="Verificando tus permisos…" />
  if (!isAuthenticated) return <Navigate to="/ingresar" replace />
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />
  return <AppLayout>{children}</AppLayout>
}

/** Panel del negocio: exige ficha de equipo. */
function StaffRoute({ children }) {
  const { isAuthenticated, isStaff, loading } = useAuth()
  if (loading) return <PageLoader label="Verificando tus permisos…" />
  if (!isAuthenticated) return <Navigate to="/ingresar" replace />
  if (!isStaff) return <Navigate to="/dashboard" replace />
  return <AppLayout>{children}</AppLayout>
}

function PublicRoute({ children }) {
  const { isAuthenticated, isStaff, loading } = useAuth()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to={isStaff ? '/agenda' : '/dashboard'} replace />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/*
                La raíz ya no es "el negocio": es un atajo al negocio por
                defecto, para no romper los links que ya circulan.
              */}
              <Route path="/" element={<Navigate to={`/n/${DEFAULT_TENANT}`} replace />} />

              {/*
                Portal público de cada negocio. El slug de la dirección define
                de qué negocio se está hablando, y es lo que permite que varios
                convivan en la misma instalación.
              */}
              <Route
                path="/n/:slug"
                element={
                  <TenantProvider>
                    <PublicRoute><Landing /></PublicRoute>
                  </TenantProvider>
                }
              />
              <Route
                path="/n/:slug/ingresar"
                element={
                  <TenantProvider>
                    <PublicRoute><Login /></PublicRoute>
                  </TenantProvider>
                }
              />

              {/*
                Login sin negocio en la dirección: sirve para el equipo y para
                quien ya tiene cuenta (su negocio sale de su ficha, no de la
                URL). Para registrarse hace falta el link del negocio.
              */}
              <Route path="/ingresar" element={<PublicRoute><Login /></PublicRoute>} />

              <Route path="/dashboard" element={<ClientRoute><Dashboard /></ClientRoute>} />
              <Route path="/reservar" element={<ClientRoute><BookAppointment /></ClientRoute>} />
              <Route path="/mis-citas" element={<ClientRoute><MyAppointments /></ClientRoute>} />
              <Route path="/perfil" element={<ClientRoute><Profile /></ClientRoute>} />

              {/* Panel del negocio */}
              <Route path="/agenda" element={<StaffRoute><AdminAgenda /></StaffRoute>} />
              <Route path="/clientes" element={<StaffRoute><AdminClients /></StaffRoute>} />
              <Route path="/servicios" element={<StaffRoute><AdminServices /></StaffRoute>} />
              <Route path="/profesionales" element={<StaffRoute><AdminProfessionals /></StaffRoute>} />
              <Route path="/planes" element={<StaffRoute><AdminPlans /></StaffRoute>} />
              <Route path="/mi-cuenta" element={<StaffRoute><AdminProfile /></StaffRoute>} />

              {/* Plataforma (dueño de Agendik, por encima de cada negocio) */}
              <Route path="/negocios" element={<PlatformRoute><AdminBusinesses /></PlatformRoute>} />

              {/*
                Llega desde el mail de recuperación. No va dentro de
                PublicRoute: quien pide el link queda con una sesión temporal,
                y PublicRoute lo mandaría al panel sin dejarlo cambiarla.
              */}
              <Route path="/recuperar" element={<ResetPassword />} />

              {/* Pública: confirmar o cancelar desde email / WhatsApp */}
              <Route path="/cita/:token" element={<AppointmentAction />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#143830',
              color: '#F3F1EA',
              fontSize: '0.875rem',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
            },
            success: { iconTheme: { primary: '#55A78E', secondary: '#143830' } },
            error: { iconTheme: { primary: '#FB7185', secondary: '#143830' } },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}
