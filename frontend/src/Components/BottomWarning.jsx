import { Link } from "react-router-dom"

export const BottomWarning = ({ label, page, to }) => {
    return <p className="mt-6 text-center text-sm text-slate-500">
        {label}
        <Link className="font-medium text-brand hover:underline" to={to}>
            {page}
        </Link>
    </p>
}
