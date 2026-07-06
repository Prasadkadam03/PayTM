import { Link } from "react-router-dom"

export const AuthCard = ({ children }) => {
    return <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <Link to="/" className="mb-8 text-2xl font-bold text-brand-navy">
            Pay<span className="text-brand">TM</span>
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {children}
        </div>
    </div>
}
