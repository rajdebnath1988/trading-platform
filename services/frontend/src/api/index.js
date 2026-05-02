import axios from 'axios'

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('tradex_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('tradex_token')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

export const authAPI = {
  register: d => api.post('/auth/register', d),
  login:    d => api.post('/auth/login', d),
  me:       () => api.get('/auth/me'),
}
export const marketAPI = {
  stocks:  ()      => api.get('/market/stocks'),
  stock:   s       => api.get(`/market/stocks/${s}`),
  chart:   (s, p)  => api.get(`/market/stocks/${s}/chart?period=${p || '1M'}`),
}
export const orderAPI = {
  place: d      => api.post('/orders', d),
  list:  params => api.get('/orders', { params }),
}
export const portfolioAPI = {
  get:   ()  => api.get('/portfolio'),
  trade: d   => api.post('/portfolio/trade', d),
}
export default api
