import { Heading } from "../Components/Heading"
import {SubHeading} from "../Components/SubHeading"
import {InputBox} from "../Components/InputBox"
import { Button } from "../Components/Button"
import { ButtonWarning } from "../Components/BottomWarning"
import { useState } from "react"
import axios from "axios"


export const Signup = () => {
    
    const [firstName , setFirstName] = useState("");
    const [lastName , setLastName] = useState("");
    const [username , setUserName] = useState("");
    const [password , setPassword] = useState("");

    return <div className="bg-zinc-300 h-screen flex justify-center">
        <div className="flex flex-col  justify-center">

            <div className=" rounded-lg bg-white w-110 text-center shadow-2xl shadow-gray-900  hover:shadow-cyan-700/100  p-10">
                <Heading label={"SIGN UP"} />
                
                <SubHeading label = {"Enter your Information to Create your account"}/>
                
                <InputBox onChange={e => {
                    setFirstName(e.target.value);
                }} label = {"First Name"} placeholder = "Prasad"/>
                
                <InputBox onChange={e => {
                    setLastName(e.target.value);
                }} label = {"Last Name"} placeholder = "Kadam"/>
                
                <InputBox onChange={e => {
                    setUserName(e.target.value);
                }} label = {"User Name"} placeholder = "Prasad@gmail.com"/>
                
                <InputBox onChange={e => {
                    setPassword(e.target.value);
                }} label = {"Password"} placeholder = "******"/>
                
                <div>
                    <Button onPress={async () => {
                        const reasponse = await axios.post("http://localhost:3000/api/v1/user/signup" , {
                            firstName,
                            lastName,
                            username,
                            password
                        });

                        localStorage.setItem("token" , reasponse.data.token)
                        
                    }} label={"Sign Up"} />
                </div>
                
                <ButtonWarning label={"Already have an account? "} page={"Signin"} to={"/Signin"}  />
            
            </div>
        </div>
    </div>
} 