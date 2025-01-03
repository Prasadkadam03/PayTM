import { useSearchParams } from "react-router-dom"
import { Button } from "../Components/Button"
import { Heading } from "../Components/Heading"
import { InputBox } from "../Components/InputBox"
import { useState } from "react"
import axios from "axios"
import { toast } from 'react-toastify';
import { useNavigate } from "react-router-dom"

export const SendMoney = () => {

    const [searchParams] = useSearchParams();

    const id = searchParams.get("id");
    const fname = searchParams.get("fname");
    const lname = searchParams.get("lname");

    const [amount, setAmount] = useState("");

    const navigate = useNavigate();



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


                <div className="p-1 ">
                    <div className=" flex flex-start block p-1.5 text-sm font-medium ">
                        Amount ( in ₹ )
                    </div>
                    <input
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value >= 0 || value === "") {
                                setAmount(value);
                            }
                        }}
                        placeholder="Enter Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-slate-50 border border-slate-300 text-bold text-medium rounded-lg w-full p-2"
                        required
                    />

                </div>

                <Button onPress={ async() => {
                    const transferPromise = axios.post(
                        `${import.meta.env.VITE_SERVER_URL}/api/v1/account/transfer`,
                        { to: id, amount },
                        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                    );

                    toast.promise(
                        transferPromise,
                        {
                            pending: "Initiating transfer...",
                            success: "Transfer initiated successfully",
                        },

                    )


                    try {
                        await transferPromise;
                    } catch (error) {
                        console.error("Transfer failed", error);
                        toast.error(`Failed to initiate transfer: ${error.response?.data?.message || error.message}`);
                    }
                }} label={"Initiate transfer"} />
                <Button onPress={() => {
                    navigate("/dashboard");
                }} label={"Dashboard"} />
            </div>
        </div>
    </div>
} 