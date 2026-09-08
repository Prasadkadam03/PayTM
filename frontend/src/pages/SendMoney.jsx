import { useSearchParams, useNavigate } from "react-router-dom"
import { Button } from "../Components/Button"
import { Heading } from "../Components/Heading"
import { AuthCard } from "../Components/AuthCard"
import { useState } from "react"
import axios from "axios"
import { toast } from "react-toastify";
import { formatINR, toPaise } from "../utils/money";

export const SendMoney = () => {

    const [searchParams] = useSearchParams();

    const id = searchParams.get("id");
    const fname = searchParams.get("fname") || "";
    const lname = searchParams.get("lname") || "";

    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);

    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        const paise = toPaise(amount);
        if (!Number.isInteger(paise) || paise <= 0) {
            toast.error("Enter a valid amount (up to 2 decimals)");
            return;
        }
        setSending(true);
        try {
            await toast.promise(
                axios.post(
                    `${import.meta.env.VITE_SERVER_URL}/api/v1/account/transfer`,
                    { to: id, amount: paise, note: note.trim() || undefined },
                    { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                ),
                {
                    pending: "Sending money...",
                    success: `${formatINR(paise)} sent to ${fname}`,
                    error: {
                        render({ data }) {
                            return data?.response?.data?.message || "Transfer failed";
                        },
                    },
                }
            );
            navigate("/dashboard");
        } catch {
            setSending(false);
        }
    };

    return <AuthCard>
        <form onSubmit={onSubmit}>
            <Heading label={"Send money"} />

            <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white font-semibold">
                    {fname[0]?.toUpperCase()}
                </div>
                <div>
                    <p className="text-xs text-slate-500">Paying</p>
                    <p className="font-medium">{fname} {lname}</p>
                </div>
            </div>

            <label className="mt-6 block">
                <span className="block mb-1.5 text-sm font-medium text-slate-700">Amount</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                    <span className="text-lg text-slate-400">₹</span>
                    <input
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value >= 0 || value === "") {
                                setAmount(value);
                            }
                        }}
                        value={amount}
                        placeholder="0.00"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        className="w-full bg-transparent px-2 py-3 text-lg font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        required
                    />
                </div>
            </label>

            <label className="mt-4 block">
                <span className="mb-1.5 flex justify-between text-sm font-medium text-slate-700">
                    Note <span className="font-normal text-slate-400">{note.length}/100</span>
                </span>
                <input
                    onChange={(e) => setNote(e.target.value)}
                    value={note}
                    maxLength={100}
                    placeholder="What's it for? (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/15"
                />
            </label>

            <div className="mt-6 space-y-3">
                <Button type="submit" label={sending ? "Sending..." : "Pay now"} disabled={sending} />
                <Button variant="secondary" onPress={() => navigate("/dashboard")} label={"Back to dashboard"} />
            </div>
        </form>
    </AuthCard>
}
