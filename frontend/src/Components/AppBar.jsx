import axios from "axios";
import { useEffect, useState } from "react"
import { Button } from "./Button";

export const AppBar = () => {

    const [firstName, setFirstName] = useState("");

    useEffect(() => {
        const userToken = localStorage.getItem("token");

        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/getUser", {
            headers: {
                authorization: "Bearer " + userToken,
            },
        })
            .then((response) => {
                setFirstName(response.data.firstName);
            }).catch((err) => {
                console.log("error=" + err);

            })

    }, []);

    return <div className="py-6">
        <div className="flex justify-between rounded-lg p-2  bg-white shadow-2xl  hover:shadow-cyan-200/100 " >
            <div className="font-bold font-sans text-4xl text-cyan-500 px-4">
                PayTm
            </div>
            <div className="flex justify-center h-full ">
                <div className="font-medium  text-2xl pr-2 pt-2">
                    Hello {firstName}
                </div>
                <div className="rounded-full h-12 w-12 bg-cyan-200 flex justify-center mt-1 mr-2">
                    <div className="flex flex-col justify-center h-full text-xl">
                        {firstName[0]?.toUpperCase()}
                    </div>
                </div>
            </div>
        </div>
    </div>
}