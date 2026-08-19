import { useAuth } from '../../lib/auth';
import AppShell from '../../components/AppShell';

/**
 * Profile page — only /api/users/me exists today.
 * QR codes and attendance (design §3) are not implemented on the backend yet.
 */
export default function ProfilePage() {
  const { user, loading, logout, isAuthenticated } = useAuth();

  return (
    <AppShell activeKey="profile">
      <section className="schedule-panel">
        <p className="schedule-title">My Profile</p>
        {loading && <p>Loading profile…</p>}
        {!loading && !isAuthenticated && (
          <p>
            Log in to load your profile from <code>GET /api/users/me</code>.
          </p>
        )}
        {!loading && user && (
          <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 22, fontFamily: "'Jua', sans-serif", color: '#a172ff' }}>
              {user.firstName} {user.lastName}
            </p>
            <p style={{ margin: 0 }}><strong>Email:</strong> {user.email}</p>
            <p style={{ margin: 0 }}><strong>Role:</strong> {user.role}</p>
            <p style={{ margin: 0 }}><strong>Status:</strong> {user.status}</p>
            <p style={{ margin: 0, color: '#765c3a' }}>
              QR code and food-event attendance are not available yet — those APIs are
              still missing from the backend (Phase 6).
            </p>
            <button type="button" className="chip purple" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
