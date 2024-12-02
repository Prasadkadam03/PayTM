export const Balance = ({label}) => {
    return <div className="font-bold  text-2xl p-1 flex justify-start" >
        <div >Your Balance :    </div>
        <div className="pl-2 font-semibold text-cyan-400" >₹ {label}</div>
    </div>
 }