export const InputBox = ({ label, placeholder }) => {
    return <div className="p-1 ">
        <div className=" flex flex-start block p-1.5 text-sm font-medium ">
            {label}
        </div>
        <input placeholder={placeholder} className=" bg-slate-50 border border-slate-300 text-bold text-medium rounded-lg  w-full p-2" required />
    </div>
}