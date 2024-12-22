import { Heading } from "../Components/Heading"
import { SubHeading } from "../Components/SubHeading"
import { InputBox } from "../Components/InputBox"
import { Button } from "../Components/Button"
import { BottomWarning } from "../Components/BottomWarning"
import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"


export const Signup = () => {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    return <div className="bg-zinc-300 h-screen flex justify-center">
        <div className="flex flex-col justify-center p-4">

            <div className="rounded-lg bg-white w-full text-center shadow-2xl shadow-gray-900 hover:shadow-cyan-700/100 p-10">
                <Heading label={"SIGN UP"} />

                <SubHeading label={"Enter your Information to Create your account"} />

                <InputBox onChange={e => {
                    setFirstName(e.target.value);
                }} label={"First Name"} placeholder="Prasad" />

                <InputBox onChange={e => {
                    setLastName(e.target.value);
                }} label={"Last Name"} placeholder="Kadam" />

                <InputBox onChange={e => {
                    setUserName(e.target.value);
                }} label={"User Name"} placeholder="Prasad@gmail.com" />

                <InputBox onChange={e => {
                    setPassword(e.target.value);
                }} label={"Password"} placeholder="******" />

                <div>
                    <Button onPress={async () => {
                        const response = axios.post(import.meta.env.VITE_SERVER_URL + "/api/v1/user/signup", {
                            firstName,
                            lastName,
                            username,
                            password
                        }).then((response) => {
                            localStorage.setItem("token", response.data.token);
                        });
                        await toast.promise(response, {
                            pending: "Signing up...",
                            success: "Signed up successfully... \nU Have 1000 in your account",
                            error: "Invalid credentials"
                        })
                        navigate("/dashboard");

                    }} label={"Sign Up"} />
                </div>

                <BottomWarning label={"Already have an account? "} page={"Signin"} to={"/Signin"} />

            </div>
        </div>
    </div>
} 