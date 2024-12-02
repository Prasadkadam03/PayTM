import { Heading } from "../Components/Heading"
import {SubHeading} from "../Components/SubHeading"
import {InputBox} from "../Components/InputBox"
import { Button } from "../Components/Button"
import { ButtonWarning } from "../Components/BottomWarning"


export const Signin = () => {
    return <div className="bg-zinc-300 h-screen flex justify-center ">
        <div className="flex flex-col  justify-center ">

            <div className=" rounded-lg bg-white w-110  text-center shadow-2xl shadow-gray-900  hover:shadow-cyan-700/100  p-10 ">
                <Heading label={"SIGN IN"} />
                <SubHeading label={"Enter your credentials to Access your account"} />

                <InputBox label={"Email"} placeholder="Prasad@gmail.com" />
                <InputBox label={"Password"} placeholder="******" />
                <div>
                    <Button label={"Sign In"} />
                </div>
                <ButtonWarning label={"Dont have an account? "} page={"Signup"} to={"/Signup"}  ></ButtonWarning>
            </div>
        </div>
    </div>
} 