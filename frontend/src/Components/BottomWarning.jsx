import { Link } from "react-router-dom"

export const ButtonWarning = ({ label, page, to }) => {
    return <div className="text-sm text-slate-600 pb-1.5" >
        {label}
        <Link className="text-slate-650 underline" to={to}>
            {page}
        </Link>
    </div>

}