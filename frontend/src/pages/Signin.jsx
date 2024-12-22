import { Heading } from "../Components/Heading"
import {SubHeading} from "../Components/SubHeading"
import {InputBox} from "../Components/InputBox"
import { Button } from "../Components/Button"
import { BottomWarning } from "../Components/BottomWarning"
import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"


export const Signin = () => {
    
    const [username , setUserName] = useState("");
    const [password , setPassword] = useState("");

    const navigate = useNavigate();

    return <div className="bg-zinc-300 h-screen flex justify-center ">
        <div className="flex flex-col  justify-center p-4">

            <div className=" rounded-lg bg-white w-full  text-center shadow-2xl shadow-gray-900  hover:shadow-cyan-700/100  p-10 ">
                <Heading label={"SIGN IN"} />
                <SubHeading label={"Enter your credentials to Access your account"} />

                <InputBox onChange={ e => {
                    setUserName(e.target.value);
                }} label={"Email"} placeholder="Prasad@gmail.com" />
                
                <InputBox onChange={e => {
                    setPassword(e.target.value);
                }} label={"Password"} placeholder="******" />
               
                <div>
                    <Button onPress={ async () => {
                        const response =  axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/signin", {
                            username,
                            password
                        }).then((response) => {
                            localStorage.setItem("token", response.data.token);
                        });

                        await toast.promise(response, {
                            pending: "Signing in...",
                            success: "Signed in successfully..... \nWelcome to dashboard",
                            error: "Invalid credentials \nPlease try again"
                        })
                        
                        
                        navigate("/dashboard");

                    }} label={"Sign In"} />
                </div>
                <BottomWarning label={"Dont have an account? "} page={"Signup"} to={"/Signup"} />
            </div>
        </div>
    </div>
} 