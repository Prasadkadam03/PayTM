import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import { Landing } from "./pages/Landing";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";
import { Dashboard } from "./pages/Dashboard";
import { SendMoney } from "./pages/SendMoney";
import { ProtectedRoute, GuestRoute } from "./Components/RouteGuards";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <div className="font-sans">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
          <Route path="/signin" element={<GuestRoute><Signin /></GuestRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/send" element={<ProtectedRoute><SendMoney /></ProtectedRoute>} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-center" />
    </div>
  )
}

export default App
