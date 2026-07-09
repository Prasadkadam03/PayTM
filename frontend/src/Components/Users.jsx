import { useEffect, useState } from "react"
import axios from "axios";
import { useNavigate } from "react-router-dom";


export const Users = () => {

    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);

    const userToken = localStorage.getItem("token");


    useEffect(() => {
        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/bulk?filter=" + filter, {
            headers: {
                authorization: "Bearer " + userToken,
            },
        })
            .then(response => {
                setUsers(response.data.users || [])
                setLoading(false);
            }).catch((err) => {
                console.log("error=" + err);
            })
    }, [filter])

    return <section className="mt-8 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <h2 className="text-base font-semibold">Send money to</h2>
            <input
                onChange={e => setFilter(e.target.value)}
                type="search"
                placeholder="Search people"
                aria-label="Search people"
                className="w-full sm:w-60 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
            />
        </div>

        <ul className="divide-y divide-slate-100">
            {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-4 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="h-3 w-40 rounded bg-slate-100" />
                    </li>
                ))
                : users.map(user => <User key={user._id} user={user} />)}
        </ul>

        {!loading && users.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No users found.</p>
        )}
    </section>
}

function User({ user }) {
    const navigate = useNavigate();
    const params = new URLSearchParams({ id: user._id, fname: user.firstName, lname: user.lastName });

    return <li className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50">
        <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-navy">
                {user.firstName[0]?.toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">{user.firstName} {user.lastName}</span>
        </div>

        <button
            onClick={() => navigate("/send?" + params.toString())}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-navy transition-colors"
        >
            Send
        </button>
    </li>
}
