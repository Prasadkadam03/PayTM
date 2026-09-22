import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AppBar } from "../Components/AppBar";
import { InputBox } from "../Components/InputBox";
import { Button } from "../Components/Button";

export const api = import.meta.env.VITE_SERVER_URL + "/api/v1/user";
export const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });

export const Card = ({ title, subtitle, children }) => (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-4">{children}</div>
    </section>
);

const PinCard = ({ hasPin, onSaved }) => {
    const [password, setPassword] = useState("");
    const [pin, setPin] = useState("");
    const [saving, setSaving] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await axios.post(api + "/pin", { password, pin }, auth());
            toast.success(response.data.message);
            e.target.reset();
            setPin("");
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not save PIN");
        } finally {
            setSaving(false);
        }
    };

    return <Card title="Transaction PIN" subtitle={hasPin ? "Asked on every payment. Enter your password to change it." : "You need a PIN before you can send money."}>
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-x-3">
            <InputBox onChange={e => setPassword(e.target.value)} label="Password" placeholder="••••••••" type="password" autoComplete="current-password" />
            <label className="block text-left mb-4">
                <span className="block mb-1.5 text-sm font-medium text-slate-700">{hasPin ? "New PIN" : "PIN"} (4-6 digits)</span>
                <input
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm tracking-[0.4em] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
                    required
                />
            </label>
            <div className="sm:col-span-2">
                <Button type="submit" label={saving ? "Saving..." : hasPin ? "Change PIN" : "Set PIN"} disabled={saving} />
            </div>
        </form>
    </Card>
};

export const Profile = () => {
    const [me, setMe] = useState(null);

    const load = () => axios.get(api + "/getUser", auth())
        .then((response) => setMe(response.data))
        .catch(() => {});

    useEffect(() => { load(); }, []);

    return <div className="min-h-screen">
        <AppBar />
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Profile & security</h1>
                <Link to="/dashboard" className="text-sm font-medium text-brand hover:underline">Back to dashboard</Link>
            </div>
            {me && <p className="mt-1 text-sm text-slate-500">{me.firstName} {me.lastName} · {me.username}</p>}

            {me && <PinCard hasPin={me.hasPin} onSaved={load} />}
        </main>
    </div>
};
