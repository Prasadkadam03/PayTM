export const Button = ({ label, onPress, variant = "primary", type = "button", disabled = false }) => {
    const styles = {
        primary: "bg-brand-navy text-white hover:bg-brand-dark",
        secondary: "bg-white text-brand-navy border border-slate-200 hover:border-brand hover:text-brand",
    };

    return (
        <button
            type={type}
            onClick={onPress}
            disabled={disabled}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]}`}
        >
            {label}
        </button>
    );
};
