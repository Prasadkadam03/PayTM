import axios from "axios";
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom";
import { startRealtime, stopRealtime } from "../utils/realtime";

export const AppBar = () => {

    const [firstName, setFirstName] = useState("");
    const [pendingRequests, setPendingRequests] = useState(0);
    const navigate = useNavigate();

    // every signed in page has the app bar, so live updates start here
    useEffect(() => { startRealtime(); }, []);

    // badge: requests waiting for me to pay. refreshed whenever the app says something changed
    useEffect(() => {
        const loadCount = () => axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/requests/count", {
            headers: { authorization: "Bearer " + localStorage.getItem("token") },
        }).then(r => setPendingRequests(r.data.pending)).catch(() => {});
        loadCount();
        window.addEventListener("paytm:refresh", loadCount);
        return () => window.removeEventListener("paytm:refresh", loadCount);
    }, []);

    useEffect(() => {
        const userToken = localStorage.getItem("token");

        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/getUser", {
            headers: {
                authorization: "Bearer " + userToken,
            },
        })
            .then((response) => {
                setFirstName(response.data.firstName);
            }).catch((err) => {
                console.log("error=" + err);
            })

    }, []);

    const signOut = async () => {
        // ends this device's session on the server too (revokes the refresh cookie)
        await axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/logout", null, {
            headers: { authorization: "Bearer " + localStorage.getItem("token") },
        }).catch(() => {});
        stopRealtime();
        localStorage.removeItem("token");
        navigate("/signin");
    };

    return <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 py-4">
            <Link to="/dashboard" className="text-xl font-bold text-brand-navy">
                Pay<span className="text-brand">TM</span>
            </Link>
            <div className="flex items-center gap-3">
                <Link to="/requests" className="relative rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    Requests
                    {pendingRequests > 0 && (
                        <span aria-label={`${pendingRequests} waiting`} className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                            {pendingRequests > 9 ? "9+" : pendingRequests}
                        </span>
                    )}
                </Link>
                <span className="hidden sm:inline text-sm text-slate-500">Hi, <span className="font-medium text-slate-900">{firstName}</span></span>
                <Link to="/profile" title="Profile & security" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-navy hover:ring-2 hover:ring-brand">
                    {firstName[0]?.toUpperCase()}
                </Link>
                <button onClick={signOut} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    Sign out
                </button>
            </div>
        </div>
    </header>
}
