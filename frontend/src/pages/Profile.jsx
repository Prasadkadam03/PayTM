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

const TwoFactorCard = ({ me, onChanged }) => {
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [setup, setSetup] = useState(null);
    const [backupCodes, setBackupCodes] = useState(null);
    const [busy, setBusy] = useState(false);

    const run = async (fn) => {
        setBusy(true);
        try {
            await fn();
        } catch (err) {
            toast.error(err.response?.data?.message || "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    const start = (e) => { e.preventDefault(); run(async () => {
        const response = await axios.post(api + "/2fa/setup", { password }, auth());
        setSetup(response.data);
    }); };

    const enable = (e) => { e.preventDefault(); run(async () => {
        const response = await axios.post(api + "/2fa/enable", { code }, auth());
        toast.success(response.data.message);
        setBackupCodes(response.data.backupCodes);
        setSetup(null);
        onChanged();
    }); };

    const disable = (e) => { e.preventDefault(); run(async () => {
        const response = await axios.post(api + "/2fa/disable", { password, code }, auth());
        toast.success(response.data.message);
        e.target.reset();
        onChanged();
    }); };

    if (backupCodes) {
        return <Card title="Save your backup codes" subtitle="Each code works once if you lose your phone. They won't be shown again.">
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-sm">
                {backupCodes.map(c => <li key={c}>{c}</li>)}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="secondary" label="Copy" onPress={() => navigator.clipboard?.writeText(backupCodes.join("\n")).then(() => toast.success("Copied"))} />
                <Button label="I saved them" onPress={() => setBackupCodes(null)} />
            </div>
        </Card>
    }

    if (me.twoFactorEnabled) {
        return <Card title="Two-step verification is on" subtitle={`Sign in asks for a code from your authenticator app. ${me.backupCodesLeft} backup codes left.`}>
            <form onSubmit={disable} className="grid sm:grid-cols-2 gap-x-3">
                <InputBox onChange={e => setPassword(e.target.value)} label="Password" placeholder="••••••••" type="password" autoComplete="current-password" />
                <InputBox onChange={e => setCode(e.target.value.trim())} label="Code or backup code" placeholder="123 456" autoComplete="one-time-code" />
                <div className="sm:col-span-2">
                    <Button variant="secondary" type="submit" label={busy ? "Turning off..." : "Turn off"} disabled={busy} />
                </div>
            </form>
        </Card>
    }

    if (setup) {
        return <Card title="Scan with your authenticator app" subtitle="Google Authenticator, Authy or any TOTP app. Then enter the 6 digit code it shows.">
            <div className="flex flex-col sm:flex-row gap-5 items-center">
                <img src={setup.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-xl border border-slate-200" />
                <form onSubmit={enable} className="w-full">
                    <p className="mb-3 text-xs text-slate-500 break-all">Can't scan? Enter this key: <span className="font-mono text-slate-900">{setup.secret}</span></p>
                    <InputBox onChange={e => setCode(e.target.value.trim())} label="6 digit code" placeholder="123 456" autoComplete="one-time-code" />
                    <Button type="submit" label={busy ? "Checking..." : "Turn on"} disabled={busy} />
                </form>
            </div>
        </Card>
    }

    return <Card title="Two-step verification" subtitle="Ask for a code from your phone every time you sign in.">
        <form onSubmit={start} className="grid sm:grid-cols-2 gap-x-3 items-end">
            <InputBox onChange={e => setPassword(e.target.value)} label="Password" placeholder="••••••••" type="password" autoComplete="current-password" />
            <div className="mb-4">
                <Button type="submit" label={busy ? "Starting..." : "Set up"} disabled={busy} />
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
            {me && <TwoFactorCard me={me} onChanged={load} />}
        </main>
    </div>
};
