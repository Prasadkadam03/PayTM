export const InputBox = ({ label, placeholder, onChange, type = "text", autoComplete }) => {
    return <label className="block text-left mb-4">
        <span className="block mb-1.5 text-sm font-medium text-slate-700">{label}</span>
        <input
            onChange={onChange}
            placeholder={placeholder}
            type={type}
            autoComplete={autoComplete}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
            required
        />
    </label>
}
