import axios from "axios";
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom";

export const AppBar = () => {

    const [firstName, setFirstName] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const userToken = localStorage.getItem("token");

        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/getUser", {
            headers: {
                authorization: "Bearer " + userToken,
            },
        })
            .then((response) => {
                setFirstName(response.data.firstName);
            }).catch((err) => {
                console.log("error=" + err);
            })

    }, []);

    const signOut = () => {
        localStorage.removeItem("token");
        navigate("/signin");
    };

    return <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 py-4">
            <Link to="/dashboard" className="text-xl font-bold text-brand-navy">
                Pay<span className="text-brand">TM</span>
            </Link>
            <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-slate-500">Hi, <span className="font-medium text-slate-900">{firstName}</span></span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-navy">
                    {firstName[0]?.toUpperCase()}
                </div>
                <button onClick={signOut} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    Sign out
                </button>
            </div>
        </div>
    </header>
}
