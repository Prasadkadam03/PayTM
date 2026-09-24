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

const NameCard = ({ me, onSaved }) => {
    const [firstName, setFirstName] = useState(me.firstName);
    const [lastName, setLastName] = useState(me.lastName);
    const [saving, setSaving] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.put(api, { firstName, lastName }, auth());
            toast.success("Name updated");
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not update name");
        } finally {
            setSaving(false);
        }
    };

    const field = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";
    return <Card title="Your name">
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">First name
                <input value={firstName} onChange={e => setFirstName(e.target.value)} className={field + " mt-1.5"} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">Last name
                <input value={lastName} onChange={e => setLastName(e.target.value)} className={field + " mt-1.5"} required />
            </label>
            <div className="sm:col-span-2 mt-1">
                <Button type="submit" label={saving ? "Saving..." : "Save"} disabled={saving} />
            </div>
        </form>
    </Card>
};

const PasswordCard = () => {
    const [currentPassword, setCurrent] = useState("");
    const [newPassword, setNew] = useState("");
    const [saving, setSaving] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await axios.post(api + "/password/change", { currentPassword, newPassword }, auth());
            toast.success(response.data.message);
            e.target.reset();
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not change password");
        } finally {
            setSaving(false);
        }
    };

    return <Card title="Password" subtitle="Changing it signs you out on every other device.">
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-x-3">
            <InputBox onChange={e => setCurrent(e.target.value)} label="Current password" placeholder="••••••••" type="password" autoComplete="current-password" />
            <InputBox onChange={e => setNew(e.target.value)} label="New password" placeholder="••••••••" type="password" autoComplete="new-password" />
            <div className="sm:col-span-2">
                <Button type="submit" label={saving ? "Saving..." : "Change password"} disabled={saving} />
            </div>
        </form>
    </Card>
};

// "Mozilla/5.0 (Windows NT 10.0...) Chrome/129" -> "Chrome on Windows"
const deviceName = (ua = "") => {
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown device";
    return `${browser} on ${os}`;
};

const when = (date) => new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const SessionsCard = () => {
    const [sessions, setSessions] = useState([]);

    const load = () => axios.get(api + "/sessions", auth()).then(r => setSessions(r.data.sessions)).catch(() => {});
    useEffect(() => { load(); }, []);

    const revoke = async (id) => {
        await axios.delete(api + "/sessions/" + id, auth()).catch(() => {});
        load();
    };

    const signOutAll = async () => {
        await axios.post(api + "/logout-all", null, auth()).catch(() => {});
        localStorage.removeItem("token");
        window.location.assign("/signin");
    };

    return <Card title="Where you're signed in">
        <ul className="divide-y divide-slate-100">
            {sessions.map(s => (
                <li key={s._id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{deviceName(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-navy">This device</span>}</p>
                        <p className="text-xs text-slate-500">{s.ip} · last active {when(s.lastUsedAt)}</p>
                    </div>
                    {!s.current && <button onClick={() => revoke(s._id)} className="shrink-0 text-sm font-medium text-red-600 hover:underline">Sign out</button>}
                </li>
            ))}
        </ul>
        <div className="mt-3">
            <Button variant="secondary" label="Sign out everywhere" onPress={signOutAll} />
        </div>
    </Card>
};

const EVENT_LABELS = {
    signup: "Account created",
    signin: "Signed in",
    signin_failed: "Wrong password entered",
    signin_password_ok: "Password accepted, waiting for code",
    logout: "Signed out",
    logout_all: "Signed out everywhere",
    session_revoked: "Signed out a device",
    refresh_token_reuse: "Suspicious sign in blocked, all devices signed out",
    email_verified: "Email verified",
    password_reset_requested: "Password reset requested",
    password_reset: "Password reset",
    password_changed: "Password changed",
    pin_set: "Transaction PIN set",
    pin_changed: "Transaction PIN changed",
    pin_failed: "Wrong transaction PIN",
    pin_locked: "Transaction PIN locked",
    "2fa_enabled": "Two-step verification turned on",
    "2fa_disabled": "Two-step verification turned off",
    "2fa_failed": "Wrong two-step code",
    transfer: "Money sent",
};

const ActivityCard = () => {
    const [events, setEvents] = useState([]);
    useEffect(() => {
        axios.get(api + "/activity", auth()).then(r => setEvents(r.data.events.slice(0, 15))).catch(() => {});
    }, []);

    return <Card title="Security activity" subtitle="Recent sign ins and changes to your account.">
        <ul className="divide-y divide-slate-100">
            {events.map(e => (
                <li key={e._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className={/failed|locked|reuse/.test(e.event) ? "text-red-600" : ""}>{EVENT_LABELS[e.event] || e.event}</span>
                    <span className="shrink-0 text-xs text-slate-500">{when(e.createdAt)}</span>
                </li>
            ))}
        </ul>
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

            {me && <NameCard me={me} onSaved={load} />}
            <PasswordCard />
            {me && <PinCard hasPin={me.hasPin} onSaved={load} />}
            {me && <TwoFactorCard me={me} onChanged={load} />}
            <SessionsCard />
            <ActivityCard />
        </main>
    </div>
};
