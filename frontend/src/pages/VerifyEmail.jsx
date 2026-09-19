import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthCard } from "../Components/AuthCard";
import { Heading } from "../Components/Heading";

export const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const [state, setState] = useState({ status: "loading", message: "Verifying your email..." });
    // strict mode runs effects twice in dev; the token is single use
    const sent = useRef(false);

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/verify-email", { token: searchParams.get("token") })
            .then((response) => setState({ status: "ok", message: response.data.message }))
            .catch((err) => setState({ status: "error", message: err.response?.data?.message || "Could not verify email" }));
    }, [searchParams]);

    return <AuthCard>
        <Heading label={state.status === "ok" ? "Email verified" : "Verify email"} />
        <p className={`mt-3 text-sm ${state.status === "error" ? "text-red-600" : "text-slate-500"}`}>{state.message}</p>
        {state.status !== "loading" && (
            <Link to="/dashboard" className="mt-6 block w-full rounded-xl bg-brand-navy px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark">
                Go to dashboard
            </Link>
        )}
    </AuthCard>
}
