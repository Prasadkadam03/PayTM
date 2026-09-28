import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// the refresh token is an httpOnly cookie, so requests must carry cookies
axios.defaults.withCredentials = true;

const REFRESH_URL = import.meta.env.VITE_SERVER_URL + "/api/v1/user/refresh";

// one refresh at a time: parallel 401s all wait for the same new token
let refreshing = null;
const refreshToken = () => {
  if (!refreshing) {
    refreshing = axios.post(REFRESH_URL, null, { _skipAuthRefresh: true })
      .then((response) => {
        localStorage.setItem("token", response.data.token);
        return response.data.token;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

const signOut = () => {
  localStorage.removeItem("token");
  if (window.location.pathname !== "/signin") {
    window.location.assign("/signin");
  }
};

// access token expired: get a new one from the refresh cookie and retry once.
// if that fails too the session is over, so clear it and send the user to signin
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const isAuthCall = config.url?.includes("/user/signin") || config.url?.includes("/user/signup") || config.url?.includes("/user/2fa/verify");
    if (error.response?.status !== 401 || isAuthCall || config._skipAuthRefresh) {
      return Promise.reject(error);
    }
    if (config._retried) {
      signOut();
      return Promise.reject(error);
    }
    try {
      const token = await refreshToken();
      config._retried = true;
      config.headers = { ...config.headers, Authorization: "Bearer " + token };
      return axios(config);
    } catch {
      signOut();
      return Promise.reject(error);
    }
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
