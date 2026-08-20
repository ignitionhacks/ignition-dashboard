import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/** Where a logged-in user's own portal lives, keyed by their DB-backed role. */
export function portalPathForRole(role) {
  if (role === 'organizer' || role === 'admin') return '/organizer'
  return '/schedule'
}

/**
 * Blocks rendering until we know whether the visitor is authenticated.
 * There is no login screen right now (removed — see git history), so an
 * unauthenticated visitor falls back to the hacker Schedule page in guest/mock
 * mode instead of dead-ending; the attempted location is kept in state in
 * case a login screen comes back later.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />
  if (!isAuthenticated) return <Navigate to="/schedule" state={{ from: location }} replace />
  return children
}

/**
 * Further restricts a route to a set of roles. The role comes from
 * `req.user` on the backend (GET /api/users/me) — never from anything the
 * frontend itself decided — so this is a UX convenience, not the real
 * enforcement: the organizer-only API calls the page makes are what actually
 * reject a hacker with 403. A hacker who types the URL directly is redirected
 * to their own portal before any organizer-only request is even made.
 */
export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/schedule" replace />
  if (!roles.includes(user.role)) return <Navigate to={portalPathForRole(user.role)} replace />
  return children
}

/**
 * Hacker-facing pages (Schedule/Profile) intentionally stay browsable
 * while logged out (a mock/offline demo mode — there's no login screen right
 * now), so this only redirects an already-authenticated organizer/admin away
 * to their own portal; it never blocks a guest.
 */
export function RedirectOrganizerToOwnPortal({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (user && (user.role === 'organizer' || user.role === 'admin')) {
    return <Navigate to="/organizer" replace />
  }
  return children
}

export function AuthLoading() {
  return (
    <div className="hk-landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading…</p>
    </div>
  )
}
