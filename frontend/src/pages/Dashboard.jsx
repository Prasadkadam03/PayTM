import axios from "axios";
import { AppBar } from "../Components/AppBar"
import { Balance } from "../Components/Balance"
import { Users } from "../Components/Users"
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


export const Dashboard = () => {

    const [balance, setBalance] = useState(null);
    const navigate = useNavigate();
   

    useEffect(() => {
        const userToken = localStorage.getItem("token");
    
          axios.get("http://localhost:3000/api/v1/account/balance", {
              headers: {
                authorization: "Bearer " + userToken,
              },
            })
            .then((response) => {
              setBalance(response.data.balance);
            }).catch((err)=> {
              console.log("error="+err);
              
            })
        
      }, []);

    return <div className="bg-zinc-200 min-h-screen h-full px-8">
        <AppBar />
        <div className="p-8">
            <Balance label={balance} />
            <Users />
        </div>
    </div>
} 