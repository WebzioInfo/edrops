import axios from 'axios';

// Default API URL (assuming nest backend is running on 3000 locally, can be swapped via env variables)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT Auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle global errors like 401s
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    // optional: trigger global logout if required
    console.warn("Unauthorized API call, token might have expired.");
  }
  return Promise.reject(error);
});

export default api;
