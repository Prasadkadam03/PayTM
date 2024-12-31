import axios from "axios";
import { AppBar } from "../Components/AppBar"
import { Balance } from "../Components/Balance"
import { Users } from "../Components/Users"
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThreeDots } from "react-loader-spinner";


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

  return <div className="bg-zinc-200 min-h-screen h-full sm:px-8 px-3">
    <AppBar />
    <div className="sm:px-8 px-4">
      <div className="font-bold  sm:text-2xl text-xl p-1 flex col-center justify-start" >
        <div >Your Balance :    </div>
        
        {loading ? <div>
          <div class="pl-2 font-semibold animate-pulse">
            <div class="h-7 bg-cyan-200 rounded w-16"></div>
          </div>
        </div> : <Balance label={balance} />}
      
      </div>

      <Users />
    </div>
  </div>
} 