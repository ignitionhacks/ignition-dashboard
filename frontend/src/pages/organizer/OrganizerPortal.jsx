import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { fetchUserById } from '../../lib/api'
import AppShell from '../../components/AppShell'

/**
 * Organizer Portal. The lookup below calls GET /api/users/:id, an
 * organizer/admin-only endpoint (backend/src/routes/userRoutes.js) — a hacker
 * token gets a 403 straight from the API regardless of what this page renders.
 */
export default function OrganizerPortal() {
  const { user, logout } = useAuth()
  const [lookupId, setLookupId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onLookup(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const found = await fetchUserById(lookupId.trim())
      setResult(found)
    } catch (err) {
      setError(err.message || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell activeKey="organizer">
      <section className="schedule-panel">
        <p className="schedule-title">Organizer Portal</p>
        <p style={{ marginTop: 0 }}>
          Signed in as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.role})
        </p>

        <form onSubmit={onLookup} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0' }}>
          <label htmlFor="lookup-id">Look up a user by ID</label>
          <input
            id="lookup-id"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="User ObjectId"
            required
          />
          <button type="submit" className="chip purple" disabled={loading}>
            {loading ? 'Looking up…' : 'Look up'}
          </button>
        </form>

        {error && <p role="alert" style={{ color: '#ff585b' }}>{error}</p>}
        {result && (
          <div style={{ display: 'grid', gap: 4, maxWidth: 420 }}>
            <p style={{ margin: 0 }}><strong>Name:</strong> {result.firstName} {result.lastName}</p>
            <p style={{ margin: 0 }}><strong>Email:</strong> {result.email}</p>
            <p style={{ margin: 0 }}><strong>Role:</strong> {result.role}</p>
          </div>
        )}

        <button type="button" className="chip purple" onClick={logout} style={{ marginTop: 24 }}>
          Log out
        </button>
      </section>
    </AppShell>
  )
}
