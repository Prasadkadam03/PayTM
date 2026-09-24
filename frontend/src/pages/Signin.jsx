import { Heading } from "../Components/Heading"
import { SubHeading } from "../Components/SubHeading"
import { InputBox } from "../Components/InputBox"
import { Button } from "../Components/Button"
import { BottomWarning } from "../Components/BottomWarning"
import { AuthCard } from "../Components/AuthCard"
import { useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"


export const Signin = () => {

    const [username, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // set when the account has two factor on: the password was right, the code is next
    const [mfaToken, setMfaToken] = useState(null);
    const [code, setCode] = useState("");

    const navigate = useNavigate();

    const signedIn = (token) => {
        localStorage.setItem("token", token);
        toast.success("Welcome back!");
        navigate("/dashboard");
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/signin", { username, password });
            if (response.data.mfaRequired) {
                setMfaToken(response.data.mfaToken);
                setSubmitting(false);
                return;
            }
            signedIn(response.data.token);
        } catch (err) {
            toast.error(err.response?.data?.message || "Invalid credentials, please try again");
            setSubmitting(false);
        }
    };

    const onVerify = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/2fa/verify", { mfaToken, code });
            signedIn(response.data.token);
        } catch (err) {
            toast.error(err.response?.data?.message || "Invalid code");
            // the 5 minute step expired: start over with the password
            if (err.response?.data?.message?.startsWith("Sign in again")) setMfaToken(null);
            setSubmitting(false);
        }
    };

    if (mfaToken) {
        return <AuthCard>
            <form onSubmit={onVerify}>
                <Heading label={"Two-step verification"} />
                <SubHeading label={"Enter the 6 digit code from your authenticator app, or one of your backup codes"} />
                <InputBox onChange={e => setCode(e.target.value.trim())} label={"Code"} placeholder="123 456" autoComplete="one-time-code" />
                <div className="mt-6 space-y-3">
                    <Button type="submit" label={submitting ? "Checking..." : "Verify"} disabled={submitting} />
                    <Button variant="secondary" onPress={() => { setMfaToken(null); setCode(""); setUserName(""); setPassword(""); }} label={"Back"} />
                </div>
            </form>
        </AuthCard>
    }

    return <AuthCard>
        <form onSubmit={onSubmit}>
            <Heading label={"Sign in"} />
            <SubHeading label={"Enter your credentials to access your account"} />

            <InputBox onChange={e => setUserName(e.target.value)} label={"Email"} placeholder="prasad@gmail.com" type="email" autoComplete="email" />
            <InputBox onChange={e => setPassword(e.target.value)} label={"Password"} placeholder="••••••••" type="password" autoComplete="current-password" />
            <div className="-mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link>
            </div>

            <div className="mt-6">
                <Button type="submit" label={submitting ? "Signing in..." : "Sign in"} disabled={submitting} />
            </div>
        </form>
        <BottomWarning label={"Don't have an account? "} page={"Sign up"} to={"/signup"} />
    </AuthCard>
}
