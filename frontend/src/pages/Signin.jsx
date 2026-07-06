import { Heading } from "../Components/Heading"
import { SubHeading } from "../Components/SubHeading"
import { InputBox } from "../Components/InputBox"
import { Button } from "../Components/Button"
import { BottomWarning } from "../Components/BottomWarning"
import { AuthCard } from "../Components/AuthCard"
import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"


export const Signin = () => {

    const [username, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await toast.promise(
                axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/signin", { username, password }),
                {
                    pending: "Signing in...",
                    success: "Welcome back!",
                    error: "Invalid credentials, please try again",
                }
            );
            localStorage.setItem("token", response.data.token);
            navigate("/dashboard");
        } catch {
            setSubmitting(false);
        }
    };

    return <AuthCard>
        <form onSubmit={onSubmit}>
            <Heading label={"Sign in"} />
            <SubHeading label={"Enter your credentials to access your account"} />

            <InputBox onChange={e => setUserName(e.target.value)} label={"Email"} placeholder="prasad@gmail.com" type="email" autoComplete="email" />
            <InputBox onChange={e => setPassword(e.target.value)} label={"Password"} placeholder="••••••••" type="password" autoComplete="current-password" />

            <div className="mt-6">
                <Button type="submit" label={submitting ? "Signing in..." : "Sign in"} disabled={submitting} />
            </div>
        </form>
        <BottomWarning label={"Don't have an account? "} page={"Sign up"} to={"/signup"} />
    </AuthCard>
}
