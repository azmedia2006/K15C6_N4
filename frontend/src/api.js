import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Gắn Access Token vào Header mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tms_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Bộ đón chặn phản hồi: Tự động gia hạn phiên (Sliding Session) theo User Story
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 và chưa thử refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('tms_refresh_token');

      if (refreshToken) {
        try {
          // Gọi API gia hạn ngầm
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newAccessToken = res.data.accessToken;

          localStorage.setItem('tms_access_token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          window.dispatchEvent(new CustomEvent('session-refreshed'));
          return api(originalRequest);
        } catch (refreshErr) {
          // Phiên đã hết hạn hoặc bị hủy trên Server
          console.warn('Phiên làm việc hết hạn:', refreshErr.response?.data?.message);
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
      } else {
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
