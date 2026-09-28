import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AppBar } from "../Components/AppBar";
import { Button } from "../Components/Button";
import { formatINR, toPaise } from "../utils/money";

const base = import.meta.env.VITE_SERVER_URL + "/api/v1";
const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });
const field = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";

const STATUS_STYLE = {
    paid: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
};

export const Split = () => {
    const [total, setTotal] = useState("");
    const [note, setNote] = useState("");
    const [mode, setMode] = useState("equal");
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    // userId -> { firstName, lastName, share (rupees text, custom mode) }
    const [picked, setPicked] = useState({});
    const [splits, setSplits] = useState([]);
    const [saving, setSaving] = useState(false);

    const loadSplits = () => axios.get(base + "/splits", auth()).then(r => setSplits(r.data.splits)).catch(() => {});
    useEffect(() => { loadSplits(); }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            axios.get(base + "/user/bulk", { ...auth(), params: { filter: search.trim(), limit: 8 } })
                .then(r => setResults(r.data.users)).catch(() => {});
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const toggle = (u) => setPicked(prev => {
        const next = { ...prev };
        if (next[u._id]) delete next[u._id];
        else next[u._id] = { firstName: u.firstName, lastName: u.lastName, share: "" };
        return next;
    });

    const ids = Object.keys(picked);
    const totalPaise = toPaise(total);
    const validTotal = Number.isInteger(totalPaise) && totalPaise > 0;
    const customPaise = ids.map(id => toPaise(picked[id].share));
    const yourShare = !validTotal || ids.length === 0 ? null
        : mode === "equal"
            ? totalPaise - Math.floor(totalPaise / (ids.length + 1)) * ids.length
            : totalPaise - customPaise.reduce((s, p) => s + (Number.isInteger(p) ? p : 0), 0);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!validTotal) return toast.error("Enter the bill total");
        if (ids.length === 0) return toast.error("Pick at least one person");
        if (mode === "custom" && customPaise.some(p => !Number.isInteger(p) || p <= 0)) return toast.error("Enter a share for every person");

        setSaving(true);
        try {
            const response = await axios.post(base + "/splits", {
                total: totalPaise,
                note: note.trim() || undefined,
                mode,
                participants: ids.map((userId, i) => (mode === "custom" ? { userId, share: customPaise[i] } : { userId })),
            }, auth());
            toast.success(`Split sent. Your share is ${formatINR(response.data.creatorShare)}`);
            setTotal(""); setNote(""); setPicked({});
            loadSplits();
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not create split");
        } finally {
            setSaving(false);
        }
    };

    return <div className="min-h-screen">
        <AppBar />
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Split a bill</h1>
                <Link to="/dashboard" className="text-sm font-medium text-brand hover:underline">Back to dashboard</Link>
            </div>

            <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-slate-700">Bill total (₹)
                        <input value={total} onChange={e => setTotal(e.target.value)} inputMode="decimal" placeholder="0.00" className={field + " mt-1.5"} required />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">What for?
                        <input value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder="Dinner, trip, rent..." className={field + " mt-1.5"} />
                    </label>
                </div>

                <div className="mt-4 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
                    {[["equal", "Split equally"], ["custom", "Custom amounts"]].map(([value, label]) => (
                        <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}
                            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${mode === value ? "bg-white text-brand-navy shadow-sm" : "text-slate-500"}`}>
                            {label}
                        </button>
                    ))}
                </div>

                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people to add" aria-label="Search people" className={field + " mt-4"} />
                <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {results.map(u => (
                        <li key={u._id}>
                            <label className="flex cursor-pointer items-center gap-3 px-1 py-2 text-sm">
                                <input type="checkbox" checked={Boolean(picked[u._id])} onChange={() => toggle(u)} className="h-4 w-4 accent-[#002E6E]" />
                                {u.firstName} {u.lastName}
                            </label>
                        </li>
                    ))}
                </ul>

                {ids.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                    {ids.map((id) => (
                        <div key={id} className="flex items-center justify-between gap-3 py-1">
                            <span>{picked[id].firstName} {picked[id].lastName}</span>
                            {mode === "custom"
                                ? <input value={picked[id].share} onChange={e => setPicked(p => ({ ...p, [id]: { ...p[id], share: e.target.value } }))} inputMode="decimal" placeholder="₹0.00" aria-label={`Share for ${picked[id].firstName}`} className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-right outline-none focus:border-brand" />
                                : <span className="font-medium">{validTotal ? formatINR(Math.floor(totalPaise / (ids.length + 1))) : "—"}</span>}
                        </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
                        <span>Your share</span>
                        <span className={yourShare !== null && yourShare < 0 ? "text-red-600" : ""}>{yourShare === null ? "—" : formatINR(yourShare)}</span>
                    </div>
                </div>}

                <div className="mt-5">
                    <Button type="submit" label={saving ? "Sending..." : "Send requests"} disabled={saving} />
                </div>
            </form>

            {splits.length > 0 && <section className="mt-8">
                <h2 className="text-base font-semibold">Your splits</h2>
                <ul className="mt-3 space-y-3">
                    {splits.map(s => {
                        const paid = s.participants.filter(p => p.status === "paid").length;
                        return <li key={s._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">{s.note || "Split bill"} · {formatINR(s.total)}</p>
                                <span className="text-xs text-slate-500">{paid} of {s.participants.length} paid</span>
                            </div>
                            <ul className="mt-2 flex flex-wrap gap-2">
                                {s.participants.map(p => (
                                    <li key={p.userId} className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[p.status] || "bg-slate-100 text-slate-600"}`}>
                                        {p.firstName} {formatINR(p.share)} · {p.status}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    })}
                </ul>
            </section>}
        </main>
    </div>
};
