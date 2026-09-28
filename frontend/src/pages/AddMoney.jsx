import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthCard } from "../Components/AuthCard";
import { Heading } from "../Components/Heading";
import { SubHeading } from "../Components/SubHeading";
import { Button } from "../Components/Button";
import { formatINR, toPaise } from "../utils/money";

const api = import.meta.env.VITE_SERVER_URL + "/api/v1/payments";
const auth = () => ({ headers: { authorization: "Bearer " + localStorage.getItem("token") } });

// razorpay's checkout script, loaded once, only on this page
const loadCheckout = () => new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(script);
});

export const AddMoney = () => {
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    useEffect(() => { loadCheckout().catch(() => {}); }, []);

    const onSubmit = async (e) => {
        e.preventDefault();
        const paise = toPaise(amount);
        if (!Number.isInteger(paise) || paise < 100) {
            toast.error("Enter at least ₹1");
            return;
        }
        setBusy(true);
        try {
            await loadCheckout();
            const { data: order } = await axios.post(api + "/order", { amount: paise }, auth());

            const checkout = new window.Razorpay({
                key: order.keyId,
                order_id: order.orderId,
                amount: order.amount,
                currency: order.currency,
                name: "PayTM",
                description: "Add money to wallet",
                theme: { color: "#002E6E" },
                // payment done at razorpay: the server checks the signature before crediting
                handler: async (result) => {
                    try {
                        await axios.post(api + "/verify", result, auth());
                        toast.success(`${formatINR(paise)} added to your wallet`);
                        navigate("/dashboard");
                    } catch (err) {
                        toast.error(err.response?.data?.message || "Payment could not be verified");
                        setBusy(false);
                    }
                },
                modal: { ondismiss: () => setBusy(false) },
            });
            checkout.on("payment.failed", (response) => {
                toast.error(response.error?.description || "Payment failed");
                setBusy(false);
            });
            checkout.open();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Could not start payment");
            setBusy(false);
        }
    };

    return <AuthCard>
        <form onSubmit={onSubmit}>
            <Heading label={"Add money"} />
            <SubHeading label={"Test mode: use Razorpay test cards or UPI success@razorpay"} />
            <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-slate-700">Amount (₹1 – ₹10,000)</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                    <span className="text-lg text-slate-400">₹</span>
                    <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" required
                        className="w-full bg-transparent px-2 py-3 text-lg font-semibold outline-none" />
                </div>
            </label>
            <div className="mt-3 flex gap-2">
                {[100, 500, 1000].map(v => (
                    <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand hover:text-brand">
                        ₹{v}
                    </button>
                ))}
            </div>
            <div className="mt-6 space-y-3">
                <Button type="submit" label={busy ? "Opening checkout..." : "Continue to pay"} disabled={busy} />
                <Button variant="secondary" onPress={() => navigate("/dashboard")} label={"Back to dashboard"} />
            </div>
        </form>
    </AuthCard>
};
