import { Button } from "../Components/Button"

export const SendMoney = () => {
    return <div className="bg-gray-400 h-screen flex justify-center">
        <div className=" flex flex-col justify-center ">
            <div className="rounded-lg bg-white shadow p-8 ">
                <div className="font-bold text-4xl p-20">
                    Send Money
                </div>
                <div className=" flex  justify-start">
                    <div className="rounded-full h-10 w-10 bg-green-400 flex justify-center mt-1 mr-2">
                        <div className="flex flex-col items-center justify-center  text-xl">
                            U
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-xl font-semibold">
                        Friends Name
                    </div>
                </div>
                <div >
                    Amount ( in ₹ )
                </div>
                <div className="my-2 p-2">
                    <input type="text" placeholder="Enter Amount " className="w-full p-2 border rounded-lg border-slate-200 "></input>
                </div>

                <Button  label={"Initiate transfer"}/>
            </div>
        </div>
    </div>
} 