import { Button } from "../Components/Button"
import { Heading } from "../Components/Heading"
import { InputBox } from "../Components/InputBox"

export const SendMoney = () => {
    return <div className="bg-zinc-300 h-screen flex justify-center">
        <div className=" flex flex-col justify-center ">
            <div className="rounded-lg bg-white  shadow-2xl shadow-gray-900 hover:shadow-cyan-700/100 w-110 p-8 ">
                <Heading label={"SEND MONEY"} />
                <div className=" flex  justify-start px-16 py-4">
                    <div className="rounded-full h-10 w-10 bg-green-400 flex justify-center mt-1 mr-2">
                        <div className="flex flex-col items-center justify-center  text-xl">
                            U
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-xl font-semibold">
                        Friends Name
                    </div>
                </div>
                <InputBox label={"Amount ( in ₹ )"} placeholder={"Enter Amount "} />

                <Button label={"Initiate transfer"} />
            </div>
        </div>
    </div>
} 