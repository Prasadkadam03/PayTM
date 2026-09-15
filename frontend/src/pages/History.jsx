import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppBar } from "../Components/AppBar";
import { formatINR } from "../utils/money";

const FILTERS = [
    { value: "all", label: "All" },
    { value: "sent", label: "Sent" },
    { value: "received", label: "Received" },
];

const dayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fetchPage = (type, cursor) => axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/account/transactions", {
    params: { type, cursor: cursor || undefined },
    headers: { authorization: "Bearer " + localStorage.getItem("token") },
});

export const History = () => {
    const [type, setType] = useState("all");
    const [transactions, setTransactions] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        fetchPage(type)
            .then((response) => {
                if (ignore) return;
                setTransactions(response.data.transactions);
                setNextCursor(response.data.nextCursor);
            })
            .catch((err) => console.log("error=" + err))
            .finally(() => !ignore && setLoading(false));
        return () => { ignore = true; };
    }, [type]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const response = await fetchPage(type, nextCursor);
            setTransactions((prev) => [...prev, ...response.data.transactions]);
            setNextCursor(response.data.nextCursor);
        } catch (err) {
            console.log("error=" + err);
        } finally {
            setLoadingMore(false);
        }
    };

    // group rows under a day heading, rows already come newest first
    const groups = [];
    for (const t of transactions) {
        const label = dayLabel(t.createdAt);
        if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
        groups.at(-1).items.push(t);
    }

    return <div className="min-h-screen">
        <AppBar />

        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Transactions</h1>
                <Link to="/dashboard" className="text-sm font-medium text-brand hover:underline">Back to dashboard</Link>
            </div>

            <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        role="tab"
                        aria-selected={type === f.value}
                        onClick={() => setType(f.value)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${type === f.value ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
                {loading && Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-0 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="h-3 w-40 rounded bg-slate-100" />
                    </div>
                ))}

                {!loading && transactions.length === 0 && (
                    <p className="px-5 py-12 text-center text-sm text-slate-500">No transactions yet.</p>
                )}

                {!loading && groups.map((group) => (
                    <div key={group.label}>
                        <h2 className="bg-slate-50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 first:rounded-t-2xl">
                            {group.label}
                        </h2>
                        <ul className="divide-y divide-slate-100">
                            {group.items.map((t) => <Row key={t._id} transaction={t} />)}
                        </ul>
                    </div>
                ))}
            </section>

            {!loading && nextCursor && (
                <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-brand-navy hover:border-brand disabled:opacity-60"
                >
                    {loadingMore ? "Loading..." : "Load more"}
                </button>
            )}
        </main>
    </div>
};

function Row({ transaction: t }) {
    const sent = t.direction === "sent";
    const name = t.counterparty ? `${t.counterparty.firstName} ${t.counterparty.lastName}` : "Deleted user";
    const time = new Date(t.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

    return <li className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${sent ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                {sent ? "↑" : "↓"}
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{sent ? "Paid to" : "Received from"} {name}</p>
                <p className="truncate text-xs text-slate-500">{time}{t.note ? ` · ${t.note}` : ""}</p>
            </div>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${sent ? "text-slate-900" : "text-emerald-600"}`}>
            {sent ? "−" : "+"}{formatINR(t.amount)}
        </span>
    </li>
}
