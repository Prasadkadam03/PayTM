import { formatINR } from "../utils/money";

export const Balance = ({ label }) => {
    return <div className="text-4xl sm:text-5xl font-semibold tracking-tight">
        {formatINR(label)}
    </div>
}
