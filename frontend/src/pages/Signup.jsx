import { Heading } from "../Components/Heading"
import {SubHeading} from "../Components/SubHeading"
import {InputBox} from "../Components/InputBox"
import { Button } from "../Components/Button"
import { ButtonWarning } from "../Components/BottomWarning"


export const Signup = () => {
    return <div className="bg-zinc-700 h-screen flex justify-center">
        <div className="flex flex-col  justify-center">

            <div className=" rounded-lg bg-white w-110 text-center shadow-xl  hover:shadow-lime-300/20  px-4">
                <Heading label={"SIGN UP"} />
                <SubHeading label = {"Enter your credentials to Create your account"}/>
                <InputBox label = {"First Name"} placeholder = "Prasad"/>
                <InputBox label = {"Last Name"} placeholder = "Kadam"/>
                <InputBox label = {"Email"} placeholder = "Prasad@gmail.com"/>
                <InputBox label = {"Password"} placeholder = "******"/>
                <div>
                    <Button label={"Sign Up"} />
                </div>
                <ButtonWarning label={"Already have an account? "} page={"Signin"} to={"/Signin"}  />
            </div>
        </div>
    </div>
} 