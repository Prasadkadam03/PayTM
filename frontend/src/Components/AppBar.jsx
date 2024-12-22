import axios from "axios";
import { useEffect, useState } from "react"

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

    return <div className="py-4 sm:py-8  sm:px-2 w-full  ">
        <div className="sm:flex justify-between rounded-lg p-2  bg-white shadow-2xl  hover:shadow-cyan-200/100 " >
            <div className="font-bold font-sans sm:text-4xl text-4xl text-center text-cyan-500 sm:px-4 px-1">
                PayTm
            </div>
            <div className="flex justify-center col-center h-full  pt-2">
                <div className="font-medium sm:pt-2 text-2xl pr-2 ">
                    Hello {firstName}
                </div>
                <div className="rounded-full sm:h-12 sm:w-12 h-8 w-8 bg-cyan-200 flex justify-center mt-1 mr-2">
                    <div className="flex flex-col justify-center h-full text-xl">
                        {firstName[0]?.toUpperCase()}
                    </div>
                </div>
            </div>
        </div>
    </div>
}