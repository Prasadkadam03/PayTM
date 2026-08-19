import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// token missing, invalid or expired: clear it so the route guards send the user to signin
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.includes("/user/signin") || error.config?.url?.includes("/user/signup");
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/signin") {
        window.location.assign("/signin");
      }
    }
    return Promise.reject(error);
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
