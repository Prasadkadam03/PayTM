import axios from "axios";
import { useState } from "react";
import { AuthCard } from "../Components/AuthCard";
import { Heading } from "../Components/Heading";
import { SubHeading } from "../Components/SubHeading";
import { InputBox } from "../Components/InputBox";
import { Button } from "../Components/Button";
import { BottomWarning } from "../Components/BottomWarning";
import { toast } from "react-toastify";

export const ForgotPassword = () => {
    const [username, setUsername] = useState("");
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/password/forgot", { username });
            setSent(true);
        } catch (err) {
            toast.error(err.response?.data?.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    return <AuthCard>
        <Heading label={"Forgot password"} />
        {sent
            ? <p className="mt-3 text-sm text-slate-500">If an account exists for {username}, a reset link is on its way. It expires in 15 minutes.</p>
            : <form onSubmit={onSubmit}>
                <SubHeading label={"We'll email you a link to choose a new password"} />
                <InputBox onChange={e => setUsername(e.target.value)} label={"Email"} placeholder="prasad@gmail.com" type="email" autoComplete="email" />
                <div className="mt-6">
                    <Button type="submit" label={submitting ? "Sending..." : "Send reset link"} disabled={submitting} />
                </div>
            </form>}
        <BottomWarning label={"Remembered it? "} page={"Sign in"} to={"/signin"} />
    </AuthCard>
}
