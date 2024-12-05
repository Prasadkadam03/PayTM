import { useSearchParams } from "react-router-dom"
import { Button } from "../Components/Button"
import { Heading } from "../Components/Heading"
import { InputBox } from "../Components/InputBox"
import { useState } from "react"
import axios from "axios"

export const SendMoney = () => {

    const [searchParams] = useSearchParams();

    const id = searchParams.get("id");
    const fname = searchParams.get("fname");
    const lname = searchParams.get("lname");

    const [Amount, setAmount] = useState("");


    return <div className="bg-zinc-300 h-screen flex justify-center">
        <div className=" flex flex-col justify-center ">
            <div className="rounded-lg bg-white  shadow-2xl shadow-gray-900 hover:shadow-cyan-700/100 w-110 p-8 ">
                <div className="flex justify-center">
                    <Heading label={"SEND MONEY"} />
                </div>
                <div className=" flex  justify-start px-16 py-4">
                    <div className="rounded-full h-10 w-10 bg-green-400 flex justify-center mt-1 mr-2">
                        <div className="flex flex-col items-center justify-center  text-xl">
                            {fname[0].toUpperCase()}
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-xl font-semibold">
                        {fname} {lname}
                    </div>
                </div>
                <InputBox onChange={(e) => {
                    setAmount(e.target.value);
                }} label={"Amount ( in ₹ )"} placeholder={"Enter Amount "} />

                <Button onPress={()=> {
                    axios.post("http://localhost:3000/api/v1/account/transfer" , {
                        to : id,
                        amount : Amount,
                    },{
                        headers: {
                            Authorization: "Bearer " + localStorage.getItem("token")
                        }
                    })
                    .then((response) => {
                        alert("transfer successfull")
                    })
                }} label={"Initiate transfer"} />
            </div>
        </div>
    </div>
} 