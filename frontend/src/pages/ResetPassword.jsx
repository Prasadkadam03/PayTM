import axios from "axios";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "../Components/AuthCard";
import { Heading } from "../Components/Heading";
import { SubHeading } from "../Components/SubHeading";
import { InputBox } from "../Components/InputBox";
import { Button } from "../Components/Button";
import { toast } from "react-toastify";

export const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) {
            toast.error("Passwords don't match");
            return;
        }
        setSubmitting(true);
        try {
            const response = await axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/password/reset", {
                token: searchParams.get("token"),
                password,
            });
            toast.success(response.data.message);
            localStorage.removeItem("token");
            navigate("/signin");
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not reset password");
            setSubmitting(false);
        }
    };

    return <AuthCard>
        <form onSubmit={onSubmit}>
            <Heading label={"New password"} />
            <SubHeading label={"At least 8 characters with a letter and a number"} />
            <InputBox onChange={e => setPassword(e.target.value)} label={"New password"} placeholder="••••••••" type="password" autoComplete="new-password" />
            <InputBox onChange={e => setConfirm(e.target.value)} label={"Confirm password"} placeholder="••••••••" type="password" autoComplete="new-password" />
            <div className="mt-6">
                <Button type="submit" label={submitting ? "Saving..." : "Save password"} disabled={submitting} />
            </div>
        </form>
    </AuthCard>
}
