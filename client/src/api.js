const TOKEN_KEY = 'frms_auth_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getMe: () => request('/api/auth/me'),
  updateProfile: (payload) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  changePassword: (payload) => request('/api/auth/password', { method: 'PUT', body: JSON.stringify(payload) }),

  // Foods
  getSummaryStats: () => request('/api/foods/stats/summary'),
  getFoods: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request(`/api/foods${query ? `?${query}` : ''}`);
  },
  getMyFoods: () => request('/api/foods/my/listings'),
  getFoodById: (id) => request(`/api/foods/${id}`),
  createFood: (payload) => request('/api/foods', { method: 'POST', body: JSON.stringify(payload) }),
  updateFood: (id, payload) => request(`/api/foods/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deactivateFood: (id) => request(`/api/foods/${id}/deactivate`, { method: 'PATCH' }),

  // Requests
  createRequest: (payload) => request('/api/requests', { method: 'POST', body: JSON.stringify(payload) }),
  getMyRequests: () => request('/api/requests/my'),
  getIncomingRequests: () => request('/api/requests/incoming'),
  respondToRequest: (id, action, rejection_reason = '') =>
    request(`/api/requests/${id}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ action, rejection_reason }),
    }),
  cancelRequest: (id) => request(`/api/requests/${id}/cancel`, { method: 'PATCH' }),

  // Distributions
  getDistributions: () => request('/api/distributions'),
  updateDistributionStatus: (id, status, notes = '') =>
    request(`/api/distributions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),

  // Notifications
  getNotifications: () => request('/api/notifications'),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),

  // Admin
  getAdminUsers: () => request('/api/admin/users'),
  createAdminUser: (payload) => request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminUser: (id, payload) =>
    request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getAdminRecords: () => request('/api/admin/records'),
  getAdminReports: () => request('/api/admin/reports'),
  getAdminBackup: () => request('/api/admin/backup'),
};
