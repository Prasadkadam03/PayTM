import axios from "axios";
import { AppBar } from "../Components/AppBar"
import { Balance } from "../Components/Balance"
import { Users } from "../Components/Users"
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


export const Dashboard = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const userToken = localStorage.getItem("token");

    axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/account/balance", {
      headers: {
        authorization: "Bearer " + userToken,
      },
    })
      .then((response) => {
        setBalance(response.data.balance);
        setLoading(false);
      }).catch((err) => {
        console.log("error=" + err);
        navigate("/signin");
      })

  }, []);

  return <div className="min-h-screen">
    <AppBar />

    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <section className="rounded-2xl bg-brand-navy p-6 sm:p-8 text-white">
        <p className="text-sm text-white/70">Available balance</p>
        <div className="mt-2">
          {loading
            ? <div className="h-12 w-48 rounded-lg bg-white/15 animate-pulse" />
            : <Balance label={balance} />}
        </div>
      </section>

      <Users />
    </main>
  </div>
}
