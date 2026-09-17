import axios from 'axios';

// Create a configured axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure default axios baseURL globally as well to support legacy direct axios calls
if (import.meta.env.VITE_BASE_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;
}

export default api;
