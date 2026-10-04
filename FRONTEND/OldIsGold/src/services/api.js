const API_URL = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '').replace(/\/api$/i, '')}/api`

async function request(path, options = {}) {
  const { headers = {}, ...requestOptions } = options
  const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData
  let response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers: isFormData ? headers : { 'Content-Type': 'application/json', ...headers },
    })
  } catch {
    throw new Error(`Cannot reach the backend at ${API_URL}. Make sure the backend server is running.`)
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    throw error
  }

  return data
}

export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: (token) => request('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
}

export const productApi = {
  list: () => request('/products'),
  mine: (token) => request('/products/mine', { headers: { Authorization: `Bearer ${token}` } }),
  byId: (id) => request(`/products/${encodeURIComponent(id)}`),
  trackView: (token, id) => request(`/products/${encodeURIComponent(id)}/view`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  create: (token, payload, files = []) => {
    if (files.length > 0) {
      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value)
        }
      })
      files.forEach((file) => formData.append('images', file))

      return request('/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
    }

    return request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  },
  update: (token, id, payload) => request(`/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
  remove: (token, id) => request(`/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }),
}

export const chatApi = {
  startConversation: (token, productId) => request('/chat/conversations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId }),
  }),
  startLostFoundConversation: (token, reportId) => request('/chat/lost-found', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reportId }),
  }),
  startCampusExchangeConversation: (token, exchangeId) => request('/chat/campus-exchange', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ exchangeId }),
  }),
  list: (token) => request('/chat/conversations', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  messages: (token, conversationId) => request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  send: (token, conversationId, payload) => request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
}

export const lostFoundApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))
    return request(`/lost-found${query.size ? `?${query}` : ''}`)
  },
  get: (id, token) => request(`/lost-found/${encodeURIComponent(id)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  create: (token, payload, files = []) => {
    const formData = new FormData()
    Object.entries(payload).forEach(([key, value]) => formData.append(key, key === 'images' ? JSON.stringify(value || []) : value))
    files.forEach((file) => formData.append('images', file))
    return request('/lost-found', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  },
  update: (token, id, payload, files = []) => {
    const formData = new FormData()
    Object.entries(payload).forEach(([key, value]) => formData.append(key, key === 'images' ? JSON.stringify(value || []) : value))
    files.forEach((file) => formData.append('images', file))
    return request(`/lost-found/${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData })
  },
  remove: (token, id) => request(`/lost-found/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  myReports: (token) => request('/lost-found/my-reports', { headers: { Authorization: `Bearer ${token}` } }),
  myClaims: (token) => request('/lost-found/my-claims', { headers: { Authorization: `Bearer ${token}` } }),
  claim: (token, id, message) => request(`/lost-found/${encodeURIComponent(id)}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ message }) }),
  updateClaim: (token, id, claimId, status) => request(`/lost-found/${encodeURIComponent(id)}/claims/${encodeURIComponent(claimId)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }),
  returned: (token, id) => request(`/lost-found/${encodeURIComponent(id)}/returned`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
}

export const campusExchangeApi = {
  list: (params = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)); return request(`/campus-exchange${query.size ? `?${query}` : ''}`) },
  get: (id, token) => request(`/campus-exchange/${encodeURIComponent(id)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  create: (token, payload, files = []) => { const formData = new FormData(); Object.entries(payload).forEach(([key, value]) => formData.append(key, key === 'images' ? JSON.stringify(value || []) : value)); files.forEach((file) => formData.append('images', file)); return request('/campus-exchange', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }) },
  update: (token, id, payload, files = []) => { const formData = new FormData(); Object.entries(payload).forEach(([key, value]) => formData.append(key, key === 'images' ? JSON.stringify(value || []) : value)); files.forEach((file) => formData.append('images', file)); return request(`/campus-exchange/${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData }) },
  remove: (token, id) => request(`/campus-exchange/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  mine: (token, page = 1, status = '') => request(`/campus-exchange/my-exchanges?page=${page}&limit=20${status ? `&status=${encodeURIComponent(status)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
  request: (token, id, message, proposal = '') => request(`/campus-exchange/${encodeURIComponent(id)}/request`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ message, ...(proposal.trim() ? { proposal } : {}) }) }),
  matches: (id) => request(`/campus-exchange/matches/${encodeURIComponent(id)}`),
  requests: (token, id) => request(`/campus-exchange/${encodeURIComponent(id)}/requests`, { headers: { Authorization: `Bearer ${token}` } }),
  accept: (token, requestId) => request(`/campus-exchange/requests/${encodeURIComponent(requestId)}/accept`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }),
  reject: (token, requestId) => request(`/campus-exchange/requests/${encodeURIComponent(requestId)}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }),
  cancel: (token, requestId) => request(`/campus-exchange/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }),
  close: (token, id) => request(`/campus-exchange/${encodeURIComponent(id)}/close`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  exchanged: (token, id) => request(`/campus-exchange/${encodeURIComponent(id)}/exchanged`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  report: (token, id, payload) => request(`/campus-exchange/${encodeURIComponent(id)}/report`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
}

export const wishlistApi = {
  list: (token) => request('/wishlist', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  add: (token, productId) => request(`/wishlist/${encodeURIComponent(productId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  remove: (token, productId) => request(`/wishlist/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }),
  check: (token, productId) => request(`/wishlist/${encodeURIComponent(productId)}/check`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
}

export const notificationApi = {
  list: (token, page = 1, limit = 30) => request(`/notifications?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  unreadCount: (token) => request('/notifications/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  markRead: (token, notificationId) => request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  }),
  markAllRead: (token) => request('/notifications/read-all', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  }),
  remove: (token, notificationId) => request(`/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }),
}

export const reportApi = {
  create: (token, payload) => request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
}

export const adminApi = {
  overview: (token) => request('/admin/overview', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  reports: (token, { status = '', page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status) params.set('status', status)
    return request(`/admin/reports?${params}`, { headers: { Authorization: `Bearer ${token}` } })
  },
  report: (token, id) => request(`/admin/reports/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  updateReport: (token, id, payload) => request(`/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
  products: (token, page = 1) => request(`/admin/products?page=${page}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  moderateProduct: (token, id, moderationStatus) => request(`/admin/products/${encodeURIComponent(id)}/moderation`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ moderationStatus }),
  }),
  user: (token, id) => request(`/admin/users/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  createCoupon: (token, payload) => request('/admin/coupons', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  createChallenge: (token, payload) => request('/admin/challenges', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
}

export const aiApi = {
  generateDescription: (token, payload) => request('/ai/generate-description', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
  estimatePrice: (token, payload) => request('/ai/estimate-price', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }),
  search: (payload) => request('/ai/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
}

export const campusAIApi = {
  search: (query) => request('/campus-ai/search', { method: 'POST', body: JSON.stringify({ query }) }),
  marketplaceSearch: (query, { page = 1, limit = 20, token } = {}) => request('/campus-ai/marketplace-search', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ query, page, limit }),
  }),
  lostFoundSearch: (query, { page = 1, limit = 20 } = {}) => request('/campus-ai/lost-found-search', {
    method: 'POST',
    body: JSON.stringify({ query, page, limit }),
  }),
  resourceSearch: (query, { page = 1, limit = 20 } = {}) => request('/campus-ai/resource-search', {
    method: 'POST',
    body: JSON.stringify({ query, page, limit }),
  }),
  recommendations: (token) => request('/campus-ai/recommendations', {
    headers: { Authorization: `Bearer ${token}` },
  }),
}

export const engagementApi = {
  feed: (token) => request('/engagement/feed', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  deals: ({ page = 1, limit = 12 } = {}) => request(`/engagement/deals?page=${page}&limit=${limit}`),
  trending: () => request('/engagement/trending'),
  recentlyViewed: (token) => request('/engagement/recently-viewed', { headers: { Authorization: `Bearer ${token}` } }),
  points: (token) => request('/engagement/points', { headers: { Authorization: `Bearer ${token}` } }),
  challenges: (token) => request('/engagement/challenges', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  claimChallenge: (token, id) => request(`/engagement/challenges/${encodeURIComponent(id)}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  polls: (token) => request('/engagement/polls', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  createPoll: (token, payload) => request('/campus-voices/polls', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  votePoll: (token, id, optionIndex) => request(`/engagement/polls/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ optionIndex }),
  }),
  closePoll: (token, id) => request(`/campus-voices/polls/${encodeURIComponent(id)}/close`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  coupons: () => request('/engagement/coupons'),
  claimCoupon: (token, code, purchaseAmount) => request('/engagement/coupons/claim', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ code, purchaseAmount }) }),
  myOffers: (token) => request('/engagement/offers/mine', { headers: { Authorization: `Bearer ${token}` } }),
  offers: (token, payload) => request('/engagement/offers', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  updateOffer: (token, id, payload) => request(`/engagement/offers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  cancelOffer: (token, id) => request(`/engagement/offers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
}

export const recommendationApi = {
  list: (token) => request('/recommendations', {
    headers: { Authorization: `Bearer ${token}` },
  }),
}

export const campusVoiceApi = {
  list: (params = {}, token) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))
    return request(`/campus-voices${query.size ? `?${query}` : ''}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  },
  get: (id, token) => request(`/campus-voices/${encodeURIComponent(id)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  create: (token, payload) => request('/campus-voices', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  update: (token, id, payload) => request(`/campus-voices/${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  remove: (token, id) => request(`/campus-voices/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  like: (token, id) => request(`/campus-voices/${encodeURIComponent(id)}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  myPosts: (token, page = 1, limit = 20) => request(`/campus-voices/my-posts?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } }),
}

export const resourceApi = {
  list: (params = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)); return request(`/resources${query.size ? `?${query}` : ''}`) },
  get: (id, token) => request(`/resources/${encodeURIComponent(id)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  create: (token, payload, file) => { const formData = new FormData(); Object.entries(payload).forEach(([key, value]) => { if (value !== undefined && value !== null) formData.append(key, value) }); if (file) formData.append('file', file); return request('/resources', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }) },
  update: (token, id, payload, file) => { const formData = new FormData(); Object.entries(payload).forEach(([key, value]) => { if (value !== undefined && value !== null) formData.append(key, value) }); if (file) formData.append('file', file); return request(`/resources/${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData }) },
  remove: (token, id) => request(`/resources/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  mine: (token, page = 1) => request(`/resources/my-resources?page=${page}&limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
  download: (token, id) => request(`/resources/${encodeURIComponent(id)}/download`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  report: (token, id, payload) => request(`/resources/${encodeURIComponent(id)}/report`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
}
