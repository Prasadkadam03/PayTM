export const Balance = ({label}) => {
    return <div className="font-bold  sm:text-2xl text-xl p-1 flex justify-start" >
        <div >Your Balance :    </div>
        <div className="pl-2 font-semibold text-cyan-400" >₹ {label}</div>
    </div>
 }