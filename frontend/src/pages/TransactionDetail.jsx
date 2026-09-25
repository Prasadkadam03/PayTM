import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AppBar } from "../Components/AppBar";
import { Button } from "../Components/Button";
import { formatINR } from "../utils/money";

const api = import.meta.env.VITE_SERVER_URL + "/api/v1/account/transactions/";
const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });
const name = (p) => (p ? `${p.firstName} ${p.lastName}` : "PayTM wallet");

export const TransactionDetail = () => {
    const { id } = useParams();
    const [t, setT] = useState(null);
    const [error, setError] = useState("");
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        axios.get(api + id, auth())
            .then((response) => setT(response.data.transaction))
            .catch((err) => setError(err.response?.data?.message || "Could not load transaction"));
    }, [id]);

    // the receipt needs the auth header, so it is fetched as a blob rather than opened as a link
    const download = async () => {
        setDownloading(true);
        try {
            const response = await axios.get(api + id + "/receipt", { ...auth(), responseType: "blob" });
            const url = URL.createObjectURL(response.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `paytm-receipt-${id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Could not download receipt");
        } finally {
            setDownloading(false);
        }
    };

    const sent = t?.direction === "sent";
    const rows = t ? [
        ["From", name(t.from)],
        ["To", name(t.to)],
        ["Date", new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
        ["Transaction ID", t._id],
        ...(t.note ? [["Note", t.note]] : []),
    ] : [];

    return <div className="min-h-screen">
        <AppBar />
        <main className="mx-auto max-w-md px-4 sm:px-6 py-8">
            <Link to="/history" className="text-sm font-medium text-brand hover:underline">← All transactions</Link>

            {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
            {!t && !error && <div className="mt-6 h-64 rounded-2xl bg-slate-100 animate-pulse" />}

            {t && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">{t.type === "topup" ? "Added to wallet" : sent ? "You paid" : "You received"}</p>
                <p className={`mt-2 text-4xl font-semibold ${sent ? "text-slate-900" : "text-emerald-600"}`}>{sent ? "−" : "+"}{formatINR(t.amount)}</p>
                <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${t.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {t.status === "success" ? "Successful" : t.status}
                </span>

                <dl className="mt-6 divide-y divide-slate-100 text-left text-sm">
                    {rows.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 py-2.5">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="text-right font-medium break-all">{value}</dd>
                        </div>
                    ))}
                </dl>

                <div className="mt-6">
                    <Button label={downloading ? "Preparing..." : "Download receipt (PDF)"} onPress={download} disabled={downloading} />
                </div>
            </section>}
        </main>
    </div>
};
