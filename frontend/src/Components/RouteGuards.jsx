import { Navigate, useLocation } from "react-router-dom"

const isSignedIn = () => Boolean(localStorage.getItem("token"));

// pages that need a signed-in user
export const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    if (!isSignedIn()) {
        return <Navigate to="/signin" replace state={{ from: location }} />
    }
    return children;
}

// signin / signup should not be shown to someone already signed in
export const GuestRoute = ({ children }) => {
    if (isSignedIn()) {
        return <Navigate to="/dashboard" replace />
    }
    return children;
}
