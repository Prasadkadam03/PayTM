import { Link } from "react-router-dom"

export const Landing = () => {
    const signedIn = Boolean(localStorage.getItem("token"));

    return <div className="min-h-screen flex flex-col">
        <header className="mx-auto w-full max-w-5xl flex items-center justify-between px-6 py-5">
            <span className="text-xl font-bold text-brand-navy">Pay<span className="text-brand">TM</span></span>
            <Link to={signedIn ? "/dashboard" : "/signin"} className="text-sm font-medium text-slate-600 hover:text-brand">
                {signedIn ? "Dashboard" : "Sign in"}
            </Link>
        </header>

        <main className="flex-1 flex items-center">
            <div className="mx-auto w-full max-w-5xl px-6 py-16">
                <span className="inline-block rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand-navy">
                    Simple. Fast. Secure.
                </span>
                <h1 className="mt-6 max-w-2xl text-4xl sm:text-5xl font-semibold leading-tight text-slate-900">
                    Send money to anyone in <span className="text-brand">seconds</span>.
                </h1>
                <p className="mt-4 max-w-xl text-slate-500">
                    Create a free wallet, get ₹1,000 to start, and pay friends instantly.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:w-auto w-full">
                    <Link to="/signup" className="rounded-xl bg-brand-navy px-6 py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark">
                        Create account
                    </Link>
                    <Link to="/signin" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-brand-navy hover:border-brand hover:text-brand">
                        I already have one
                    </Link>
                </div>
            </div>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-slate-400">
            © {new Date().getFullYear()} PayTM clone
        </footer>
    </div>
}
