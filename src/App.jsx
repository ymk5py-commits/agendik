import { Component, Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import { PageLoader } from './components/ui'
import Landing from './pages/Landing'

// La landing entra en el bundle inicial; el resto se carga al navegar.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const BookAppointment = lazy(() => import('./pages/BookAppointment'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const Profile = lazy(() => import('./pages/Profile'))
const AppointmentAction = lazy(() => import('./pages/AppointmentAction'))

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

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader label="Verificando tu sesión…" />
  if (!isAuthenticated) return <Navigate to="/ingresar" replace />
  return <AppLayout>{children}</AppLayout>
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
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
              <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/ingresar" element={<PublicRoute><Login /></PublicRoute>} />

              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/reservar" element={<PrivateRoute><BookAppointment /></PrivateRoute>} />
              <Route path="/mis-citas" element={<PrivateRoute><MyAppointments /></PrivateRoute>} />
              <Route path="/perfil" element={<PrivateRoute><Profile /></PrivateRoute>} />

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
