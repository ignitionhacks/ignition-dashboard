const TOKEN_KEY = 'ignition_dashboard_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thin fetch wrapper for the dashboard API.
 * Uses the Vite proxy (`/api` → backend) so the frontend never hardcodes a port.
 */
export async function apiFetch(path, { method = 'GET', body, token = getToken(), headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return { ok: true, status: 204, data: null };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = data.details;
    throw error;
  }

  return { ok: true, status: response.status, data };
}

export async function login(email, password) {
  const { data } = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
  });
  setToken(data.token);
  return data;
}

export async function register(payload) {
  const { data } = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: payload,
    token: null,
  });
  setToken(data.token);
  return data;
}

export async function fetchMe() {
  const { data } = await apiFetch('/api/users/me');
  return data;
}

export async function fetchSchedule({ day, category } = {}) {
  const params = new URLSearchParams();
  if (day) params.set('day', day);
  if (category) params.set('category', category);
  const query = params.toString();
  const { data } = await apiFetch(`/api/schedule${query ? `?${query}` : ''}`);
  return data;
}

export async function fetchUpcoming(limit = 5) {
  const { data } = await apiFetch(`/api/schedule/upcoming?limit=${limit}`);
  return data;
}

export async function fetchAnnouncements({ limit = 5, page = 1 } = {}) {
  const { data } = await apiFetch(`/api/announcements?limit=${limit}&page=${page}`);
  return data;
}

/** Organizer/admin only — GET /api/users/:id returns 403 for a hacker token. */
export async function fetchUserById(id) {
  const { data } = await apiFetch(`/api/users/${id}`);
  return data;
}
