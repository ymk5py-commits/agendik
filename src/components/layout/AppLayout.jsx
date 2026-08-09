import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Home, LogOut, Menu, Plus, User, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isDemoMode } from '../../api/backend'
import { Logo } from '../Logo'
import { initials } from '../../utils/format'

const NAV_CLIENTE = [
  { to: '/dashboard', label: 'Inicio', icon: Home },
  { to: '/reservar', label: 'Nueva cita', icon: Plus },
  { to: '/mis-citas', label: 'Mis citas', icon: CalendarDays },
  { to: '/perfil', label: 'Mi perfil', icon: User },
]

const NAV_EQUIPO = [
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/clientes', label: 'Clientes', icon: Users },
]

const ROL = { owner: 'Dueña del negocio', staff: 'Equipo' }

export default function AppLayout({ children }) {
  const { client, staff, tenant, logout } = useAuth()
  const persona = staff || client
  const NAV = staff ? NAV_EQUIPO : NAV_CLIENTE
  const inicio = staff ? '/agenda' : '/dashboard'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => setDrawerOpen(false), [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-sand-50">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      {isDemoMode && (
        <div className="bg-accent-400 px-4 py-1.5 text-center text-xs font-semibold text-primary-950">
          Modo demo — los datos se guardan solo en este navegador
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/90 backdrop-blur">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <NavLink to={inicio} className="shrink-0 rounded-lg" aria-label="Agendik, ir al inicio">
            <Logo subtitle={tenant?.businessName || 'Portal de citas'} />
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-800'
                      : 'text-sand-600 hover:bg-sand-100 hover:text-sand-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-2.5 border-l border-sand-200 pl-3">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                  staff ? 'bg-accent-600' : 'bg-primary-800'
                }`}
              >
                {initials(persona?.name)}
              </span>
              <span className="leading-tight">
                <span className="block max-w-[9rem] truncate text-sm font-semibold text-sand-900">
                  {persona?.name}
                </span>
                <span className="block text-xs text-sand-500">
                  {staff ? ROL[staff.role] || 'Equipo' : 'Cliente'}
                </span>
              </span>
            </div>
            <button type="button" onClick={handleLogout} className="btn-ghost px-2.5" aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Salir</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-sand-700 transition-colors hover:bg-sand-100 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col bg-white shadow-lifted animate-slide-in-right"
          >
            <div className="flex items-center justify-between border-b border-sand-200 p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                    staff ? 'bg-accent-600' : 'bg-primary-800'
                  }`}
                >
                  {initials(persona?.name)}
                </span>
                <span className="leading-tight">
                  <span className="block truncate text-sm font-semibold text-sand-900">{persona?.name}</span>
                  <span className="block text-xs text-sand-500">{persona?.email}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-sand-500 transition-colors hover:bg-sand-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-3" aria-label="Navegación principal">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary-100 text-primary-800' : 'text-sand-700 hover:bg-sand-100'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-sand-200 p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="contenido" className="container-app py-6 lg:py-10">
        {children}
      </main>

      <footer className="border-t border-sand-200 py-6">
        <div className="container-app flex flex-col items-center justify-between gap-2 text-xs text-sand-500 sm:flex-row">
          <p>
            Agendik · {tenant?.businessName || 'Portal del cliente'}
          </p>
          <p>Horarios en zona América/Asunción</p>
        </div>
      </footer>
    </div>
  )
}
