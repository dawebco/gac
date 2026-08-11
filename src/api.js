const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

let adminCsrfToken = '';

export class ApiClientError extends Error {
  constructor(message, code = 'API_ERROR', status = 500, details) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body && typeof options.body !== 'string' && !isFormData ? JSON.stringify(options.body) : options.body,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error || {};
    throw new ApiClientError(error.message || 'The server request failed.', error.code, response.status, error.details);
  }
  return payload.data;
}

function adminMutation(path, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: { ...options.headers, 'X-CSRF-Token': adminCsrfToken },
  });
}

const bookingTypes = { Flights: 'FLIGHTS', Hotels: 'HOTELS', Holidays: 'HOLIDAYS' };
const displayBookingTypes = { FLIGHTS: 'Flights', HOTELS: 'Hotels', HOLIDAYS: 'Holidays' };

export function mapAdminCustomer(customer) {
  return {
    ...customer,
    bookings: customer.totalBookings,
    points: customer.availablePoints,
    bookingItems: (customer.bookings || []).filter(booking => booking.status !== 'VOIDED').map(booking => ({
      ...booking,
      type: displayBookingTypes[booking.type] || booking.type,
    })),
  };
}

export const adminApi = {
  async login(username, password) {
    const data = await apiRequest('/admin/auth/login', { method: 'POST', body: { username, password } });
    adminCsrfToken = data.csrfToken;
    return data;
  },
  async restoreSession() {
    const data = await apiRequest('/admin/auth/session');
    adminCsrfToken = data.csrfToken;
    return data;
  },
  async logout() {
    try {
      await adminMutation('/admin/auth/logout', { method: 'POST' });
    } finally {
      adminCsrfToken = '';
    }
  },
  overview: () => apiRequest('/admin/overview'),
  rewards: () => apiRequest('/admin/rewards'),
  updateReward(rewardId, { title, description, image }) {
    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    if (image) form.append('image', image);
    return adminMutation(`/admin/rewards/${rewardId}`, { method: 'PATCH', body: form });
  },
  async customers(search = '') {
    const rows = await apiRequest(`/admin/customers?search=${encodeURIComponent(search)}&limit=250`);
    return rows.map(mapAdminCustomer);
  },
  async customer(phone) {
    return mapAdminCustomer(await apiRequest(`/admin/customers/${encodeURIComponent(phone)}`));
  },
  async createCustomer(form) {
    const amount = Number(form.amount) || 0;
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      ...(amount > 0 ? {
        booking: {
          bookingType: bookingTypes[form.type],
          purchasedAmount: amount,
          bookingDate: new Date().toISOString().slice(0, 10),
        },
      } : {}),
    };
    return mapAdminCustomer(await adminMutation('/admin/customers', {
      method: 'POST', body: payload, headers: { 'Idempotency-Key': crypto.randomUUID() },
    }));
  },
  addBooking(phone, form) {
    return adminMutation(`/admin/customers/${encodeURIComponent(phone)}/bookings`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: {
        bookingType: bookingTypes[form.type],
        purchasedAmount: Number(form.amount),
        bookingDate: form.date,
      },
    });
  },
  voidBooking(phone, bookingId) {
    return adminMutation(`/admin/customers/${encodeURIComponent(phone)}/bookings/${bookingId}`, {
      method: 'DELETE', body: { reason: 'Booking removed by administrator' },
    });
  },
  adjustPoints(phone, direction, points) {
    return adminMutation(`/admin/customers/${encodeURIComponent(phone)}/reward-adjustments`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: {
        direction: direction === 'add' ? 'ADD' : 'REMOVE',
        points,
        reason: direction === 'add' ? 'Manual reward credit by administrator' : 'Manual reward deduction by administrator',
      },
    });
  },
};

export const portalApi = {
  rewards: () => apiRequest('/portal/rewards'),
  register: (form) => apiRequest('/portal/customers/register', { method: 'POST', body: form }),
  dummyLogin: (phone, otp) => apiRequest('/portal/auth/dummy-login', { method: 'POST', body: { phone, otp } }),
  sessionDashboard: () => apiRequest('/portal/session/dashboard'),
  logout: () => apiRequest('/portal/session/logout', { method: 'POST' }),
};
