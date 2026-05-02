import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: `${API_BASE}/api` })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tradex_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tradex_token')
      localStorage.removeItem('tradex_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data)  => api.post('/auth/register', data),
  login:    (data)  => api.post('/auth/login', data),
  me:       ()      => api.get('/auth/me'),
}

export const marketAPI = {
  stocks:     ()           => api.get('/market/stocks'),
  stock:      (symbol)     => api.get(`/market/stocks/${symbol}`),
  chart:      (symbol, p)  => api.get(`/market/stocks/${symbol}/chart?period=${p || '1M'}`),
}

export const orderAPI = {
  place:  (data)   => api.post('/orders', data),
  list:   (params) => api.get('/orders', { params }),
}

export const portfolioAPI = {
  get:    ()      => api.get('/portfolio'),
  trade:  (data)  => api.post('/portfolio/trade', data),
}

export default api
