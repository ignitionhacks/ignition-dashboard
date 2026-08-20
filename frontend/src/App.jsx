import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import SchedulePage from './components/SchedulePage';
import ProfilePage from './pages/hacker/ProfilePage';
import OrganizerPortal from './pages/organizer/OrganizerPortal';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthLoading, portalPathForRole, RedirectOrganizerToOwnPortal, RequireRole } from './components/RouteGuards';
import './main.css';

function Schedule() {
  return (
    <RedirectOrganizerToOwnPortal>
      <AppShell activeKey="schedule">
        <SchedulePage />
      </AppShell>
    </RedirectOrganizerToOwnPortal>
  );
}

/**
 * `/portal` — the single entry point described in the routing brief: check
 * auth, identify the user, read the server-provided role, and land on the
 * matching portal. There is no login screen right now, so an unauthenticated
 * visitor falls back to the hacker Schedule page in guest/mock mode.
 * The Home/Landing page is retired: pages/hacker/Landing.jsx is kept on disk
 * but is intentionally unrouted and unreachable.
 */
function PortalEntry() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Navigate to={portalPathForRole(user.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* <Route path="/portal" element={<PortalEntry />} /> */}
          <Route path="/" element={<Schedule />} />
          {/* <Route
            path="/profile"
            element={
              <RedirectOrganizerToOwnPortal>
                <ProfilePage />
              </RedirectOrganizerToOwnPortal>
            }
          /> */}
          {/* <Route
            path="/organizer"
            element={
              <RequireRole roles={['organizer', 'admin']}>
                <OrganizerPortal />
              </RequireRole>
            }
          /> */}
          {/* <Route path="/" element={<Navigate to="/portal" replace />} />
          <Route path="*" element={<Navigate to="/portal" replace />} /> */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
