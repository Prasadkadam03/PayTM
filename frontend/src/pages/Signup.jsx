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


export const Signup = () => {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await toast.promise(
                axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/signup", { firstName, lastName, username, password }),
                {
                    pending: "Creating your account...",
                    success: "Account created! ₹1,000 added to your wallet",
                    error: {
                        render({ data }) {
                            return data?.response?.data?.message || "Could not create account";
                        },
                    },
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
            <Heading label={"Create account"} />
            <SubHeading label={"Enter your details to open a wallet"} />

            <div className="grid grid-cols-2 gap-3">
                <InputBox onChange={e => setFirstName(e.target.value)} label={"First name"} placeholder="Prasad" autoComplete="given-name" />
                <InputBox onChange={e => setLastName(e.target.value)} label={"Last name"} placeholder="Kadam" autoComplete="family-name" />
            </div>
            <InputBox onChange={e => setUserName(e.target.value)} label={"Email"} placeholder="prasad@gmail.com" type="email" autoComplete="email" />
            <InputBox onChange={e => setPassword(e.target.value)} label={"Password"} placeholder="••••••••" type="password" autoComplete="new-password" />

            <div className="mt-6">
                <Button type="submit" label={submitting ? "Creating..." : "Sign up"} disabled={submitting} />
            </div>
        </form>
        <BottomWarning label={"Already have an account? "} page={"Sign in"} to={"/signin"} />
    </AuthCard>
}
