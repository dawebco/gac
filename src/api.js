const DEFAULT_API_URL = process.env.NODE_ENV === 'production'
  ? '/api/v1'
  : 'http://localhost:4000/api/v1';
const API_BASE_URL = (process.env.REACT_APP_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

let adminCsrfToken = '';
let superAdminCsrfToken = '';

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
    const errorObj = typeof payload.error === 'object' && payload.error ? payload.error : {};
    const message = typeof payload.error === 'string'
      ? payload.error
      : (errorObj.message || payload.message || payload.detail || 'The server request failed.');
    const details = payload.detail || payload.constraint || errorObj.details;
    throw new ApiClientError(message, errorObj.code || payload.code, response.status, details);
  }
  return payload.data;
}

function adminMutation(path, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: { ...options.headers, 'X-CSRF-Token': adminCsrfToken },
  });
}

function superAdminMutation(path, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: { ...options.headers, 'X-CSRF-Token': superAdminCsrfToken },
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
  createReward({ title, description, pointsRequired, category, image }) {
    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    form.append('pointsRequired', String(pointsRequired));
    form.append('category', category);
    if (image) form.append('image', image);
    return adminMutation('/admin/rewards', { method: 'POST', body: form });
  },
  updateReward(rewardId, { title, description, pointsRequired, image }) {
    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    if (pointsRequired !== undefined) form.append('pointsRequired', String(pointsRequired));
    if (image) form.append('image', image);
    return adminMutation(`/admin/rewards/${rewardId}`, { method: 'PATCH', body: form });
  },
  deleteReward(rewardId) {
    return adminMutation(`/admin/rewards/${rewardId}`, { method: 'DELETE' });
  },
  async customers(search = '') {
    const rows = await apiRequest(`/admin/customers?search=${encodeURIComponent(search)}&limit=250`);
    return rows.map(mapAdminCustomer);
  },
  newCustomers: (search = '', limit = 250, startDate = '', endDate = '') => {
    const params = new URLSearchParams({ search, limit: String(limit) });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return apiRequest(`/admin/new-customers?${params.toString()}`);
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
  adjustPoints(phone, direction, points, reason) {
    return adminMutation(`/admin/customers/${encodeURIComponent(phone)}/reward-adjustments`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: {
        direction: direction === 'add' ? 'ADD' : 'REMOVE',
        points,
        reason,
      },
    });
  },
  redemptionRequests: () => apiRequest('/admin/redemption-requests'),
  reviewRedemption(requestId, decision) {
    return adminMutation(`/admin/redemption-requests/${requestId}/review`, {
      method: 'POST',
      body: { decision },
    });
  },
  sendWhatsAppReward({ name, phone, type, earnedPoints }) {
    return adminMutation('/admin/send-whatsapp-reward', {
      method: 'POST',
      body: { name, phone, bookingType: type, earnedPoints },
    });
  },
  requestCustomerDeletion({ phone, reason, confirmCode }) {
    return adminMutation('/admin/customers/deletion-requests', {
      method: 'POST',
      body: { phone, reason, confirmCode },
    });
  },
  pendingCustomerDeletions() {
    return apiRequest('/admin/customers/deletion-requests/pending');
  },
};

export const superAdminApi = {
  async login(username, password) {
    const data = await apiRequest('/superadmin/auth/login', { method: 'POST', body: { username, password } });
    superAdminCsrfToken = data.csrfToken;
    return data;
  },
  async restoreSession() {
    const data = await apiRequest('/superadmin/auth/session');
    superAdminCsrfToken = data.csrfToken;
    return data;
  },
  async logout() {
    try {
      await superAdminMutation('/superadmin/auth/logout', { method: 'POST' });
    } finally {
      superAdminCsrfToken = '';
    }
  },
  rewardRequests: status => apiRequest(`/superadmin/reward-requests?status=${encodeURIComponent(status || 'PENDING')}`),
  reviewRewardRequest(requestId, decision, reviewNote = '') {
    return superAdminMutation(`/superadmin/reward-requests/${requestId}/review`, {
      method: 'POST',
      body: { decision, ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}) },
    });
  },
  rewardChangeRequests: status => apiRequest(`/superadmin/reward-change-requests?status=${encodeURIComponent(status || 'PENDING')}`),
  reviewRewardChangeRequest(requestId, decision, reviewNote = '') {
    return superAdminMutation(`/superadmin/reward-change-requests/${requestId}/review`, {
      method: 'POST',
      body: { decision, ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}) },
    });
  },
  customerDeletionRequests: status => apiRequest(`/superadmin/customer-deletion-requests?status=${encodeURIComponent(status || 'PENDING')}`),
  reviewCustomerDeletionRequest(requestId, decision, reviewNote = '') {
    return superAdminMutation(`/superadmin/customer-deletion-requests/${requestId}/review`, {
      method: 'POST',
      body: { decision, ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}) },
    });
  },
};

export const portalApi = {
  rewards: () => apiRequest('/portal/rewards'),
  register: (form) => apiRequest('/portal/customers/register', { method: 'POST', body: form }),
  sendOtp: (phone) => apiRequest('/portal/auth/send-otp', { method: 'POST', body: { phone } }),
  verifyOtp: (phone, otp) => apiRequest('/portal/auth/verify-otp', { method: 'POST', body: { phone, otp } }),
  dummyLogin: (phone, otp) => apiRequest('/portal/auth/dummy-login', { method: 'POST', body: { phone, otp } }),
  sessionDashboard: () => apiRequest('/portal/session/dashboard'),
  logout: () => apiRequest('/portal/session/logout', { method: 'POST' }),
  requestRedemption(rewardId) {
    return apiRequest('/portal/rewards/redeem', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { rewardId },
    });
  },
};
