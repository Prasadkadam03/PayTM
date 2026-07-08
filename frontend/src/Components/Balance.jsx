export const Balance = ({ label }) => {
    const formatted = Number(label ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <div className="text-4xl sm:text-5xl font-semibold tracking-tight">
        ₹{formatted}
    </div>
}
