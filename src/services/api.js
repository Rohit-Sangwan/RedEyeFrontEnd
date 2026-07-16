import axios from 'axios';
import { API_BASE } from '../config';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const apiKeysAPI = {
  create: (label) => api.post('/apikeys', { label }),
  list: () => api.get('/apikeys'),
  revoke: (id) => api.delete(`/apikeys/${id}`),
  rotate: (id, label) => api.post(`/apikeys/${id}/rotate`, { label }),
  reveal: (id) => api.post(`/apikeys/${id}/reveal`)
};

export default api;
