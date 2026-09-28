import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const api = import.meta.env.VITE_SERVER_URL + "/api/v1/user";
const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });

// shown until the user clicks the link in the verification email
export const VerifyBanner = () => {
    const [verified, setVerified] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        axios.get(api + "/getUser", auth())
            .then((response) => setVerified(response.data.emailVerified))
            .catch(() => {});
    }, []);

    if (verified) return null;

    const resend = async () => {
        setSending(true);
        try {
            const response = await axios.post(api + "/verify-email/resend", null, auth());
            toast.success(response.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not send email");
        } finally {
            setSending(false);
        }
    };

    return <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>Verify your email to start sending money. Check your inbox for the link.</span>
        <button onClick={resend} disabled={sending} className="shrink-0 font-semibold text-amber-900 underline disabled:opacity-60">
            {sending ? "Sending..." : "Resend email"}
        </button>
    </div>
}
