import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AppBar } from "../Components/AppBar";
import { formatINR } from "../utils/money";

const api = import.meta.env.VITE_SERVER_URL + "/api/v1/requests";
const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });
const name = (p) => (p ? `${p.firstName} ${p.lastName}` : "Deleted user");

const STATUS_STYLE = {
    pending: "bg-amber-50 text-amber-700",
    paid: "bg-emerald-50 text-emerald-700",
    declined: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
    expired: "bg-slate-100 text-slate-600",
};

export const Requests = () => {
    const [box, setBox] = useState("incoming");
    const [requests, setRequests] = useState(null);

    const load = () => axios.get(api, { ...auth(), params: { box } })
        .then(r => setRequests(r.data.requests))
        .catch(() => setRequests([]));

    useEffect(() => {
        setRequests(null);
        load();
        // refreshes when something changes elsewhere (another tab, a live update)
        window.addEventListener("paytm:refresh", load);
        return () => window.removeEventListener("paytm:refresh", load);
    }, [box]);

    const act = async (id, action, body) => {
        try {
            const response = await axios.post(`${api}/${id}/${action}`, body, auth());
            toast.success(response.data.message);
            window.dispatchEvent(new Event("paytm:refresh"));
        } catch (err) {
            toast.error(err.response?.data?.message || "Something went wrong");
        }
    };

    return <div className="min-h-screen">
        <AppBar />
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Requests</h1>
                <Link to="/dashboard" className="text-sm font-medium text-brand hover:underline">Back to dashboard</Link>
            </div>

            <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
                {[["incoming", "To pay"], ["outgoing", "Asked by me"]].map(([value, label]) => (
                    <button key={value} role="tab" aria-selected={box === value} onClick={() => setBox(value)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${box === value ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                        {label}
                    </button>
                ))}
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
                {requests === null && <div className="h-32 animate-pulse rounded-2xl bg-slate-50" />}
                {requests?.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-500">No requests yet.</p>}
                <ul className="divide-y divide-slate-100">
                    {requests?.map(r => <Row key={r._id} r={r} box={box} act={act} />)}
                </ul>
            </section>
        </main>
    </div>
};

function Row({ r, box, act }) {
    const [pin, setPin] = useState("");
    const [paying, setPaying] = useState(false);
    const pending = r.status === "pending";
    const who = box === "incoming" ? name(r.from) : name(r.to);

    return <li className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium">{box === "incoming" ? `${who} asked you for` : `You asked ${who} for`} {formatINR(r.amount)}</p>
                <p className="truncate text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {r.note ? ` · ${r.note}` : ""}{r.splitId ? " · split bill" : ""}
                </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
        </div>

        {pending && box === "incoming" && (
            <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
                e.preventDefault();
                setPaying(true);
                await act(r._id, "pay", { pin });
                setPaying(false);
            }}>
                <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" maxLength={6} placeholder="PIN" aria-label="Transaction PIN" required
                    className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm tracking-[0.3em] outline-none focus:border-brand" />
                <button type="submit" disabled={paying} className="rounded-lg bg-brand-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                    {paying ? "Paying..." : "Pay"}
                </button>
                <button type="button" onClick={() => act(r._id, "decline")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Decline</button>
            </form>
        )}
        {pending && box === "outgoing" && (
            <button onClick={() => act(r._id, "cancel")} className="mt-2 text-xs font-medium text-red-600 hover:underline">Cancel request</button>
        )}
        {r.transactionId && (
            <Link to={"/transactions/" + r.transactionId} className="mt-2 inline-block text-xs font-medium text-brand hover:underline">View payment</Link>
        )}
    </li>
}
