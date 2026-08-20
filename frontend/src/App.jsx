import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import SchedulePage from './components/SchedulePage';
import { AuthProvider } from './lib/auth';
import './main.css';

/**
 * The portal is a single page: `/` is the Schedule and nothing else is
 * routable. Every other path (including the retired /landing, /portal,
 * /profile and /organizer) falls through the catch-all back to `/`.
 * The page components for those routes are kept on disk but unrouted.
 */
function Schedule() {
  return (
    <AppShell activeKey="schedule">
      <SchedulePage />
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Schedule />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
