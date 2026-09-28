import axios from "axios";
import { AppBar } from "../Components/AppBar"
import { Balance } from "../Components/Balance"
import { Users } from "../Components/Users"
import { VerifyBanner } from "../Components/VerifyBanner"
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";


export const Dashboard = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  // "add money" only shows when the server has razorpay keys
  const [canTopUp, setCanTopUp] = useState(false);

  useEffect(() => {
    axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/payments/config", {
      headers: { authorization: "Bearer " + localStorage.getItem("token") },
    }).then(r => setCanTopUp(r.data.enabled)).catch(() => {});
  }, []);


  useEffect(() => {
    const loadBalance = () => axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/account/balance", {
      headers: {
        authorization: "Bearer " + localStorage.getItem("token"),
      },
    })
      .then((response) => {
        setBalance(response.data.balance);
        setLoading(false);
      }).catch((err) => {
        console.log("error=" + err);
        navigate("/signin");
      })

    loadBalance();
    // money came in or went out (live update): show the new balance
    window.addEventListener("paytm:refresh", loadBalance);
    return () => window.removeEventListener("paytm:refresh", loadBalance);
  }, []);

  return <div className="min-h-screen">
    <AppBar />

    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <VerifyBanner />
      <section className="rounded-2xl bg-brand-navy p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/70">Available balance</p>
          <div className="flex gap-2">
            <Link to="/split" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
              Split bill
            </Link>
            <Link to="/history" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
              History →
            </Link>
          </div>
        </div>
        <div className="mt-2">
          {loading
            ? <div className="h-12 w-48 rounded-lg bg-white/15 animate-pulse" />
            : <Balance label={balance} />}
        </div>
        {canTopUp && (
          <Link to="/add-money" className="mt-5 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-brand-navy transition-colors">
            + Add money
          </Link>
        )}
      </section>

      <Users />
    </main>
  </div>
}
