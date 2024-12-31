import { useEffect, useState } from "react"
import { Button } from "./Button"
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ThreeDots } from "react-loader-spinner";


export const Users = () => {

    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);

    const userToken = localStorage.getItem("token");


    useEffect(() => {
        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/bulk?filter=" + filter, {
            headers: {
                authorization: "Bearer " + userToken,
            },
        })
            .then(response => {
                setUsers(response.data.users || [])
                console.log("API " + response.data.user);
                setLoading(false);
            }).catch((err) => {
                console.log("error=" + err);
                navigator
            })
    }, [filter])

    return <>
        <div className="font-bold mt-6 text-lg">
            Users
        </div>
        <div className="my-2">
            <input onChange={e => {
                setFilter(e.target.value)
            }} type="text" placeholder="Search users..." className="w-full px-2 py-1 border rounded border-slate-200"></input>
        </div>
        <div>
            {loading ? <div>
                <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            <div class="py-1 animate-pulse">
                <div class="flex rounded-lg justify-between px-4 bg-white shadow-md">
                    <div class="flex">
                        <div class="rounded-full h-12 w-12 py-1 bg-gray-200 mt-1 mr-2"></div>
                        <div class="flex flex-col justify-center h-ful">
                            <div class="bg-gray-200 rounded w-24 h-4"></div>
                        </div>
                    </div>

                    <div>
                        <div class="bg-gray-200 rounded w-24 h-8"></div>
                    </div>
                </div>
            </div> 
            </div> : <div> {users.map(user => <User key={user._id} user={user} />)} </div>}

        </div>
    </>
}

function User({ user }) {
    const navigate = useNavigate();
    return <div className="py-1">
        <div className="flex rounded-lg justify-between px-4 bg-white shadow-md hover:shadow-cyan-400/50">
            <div className="flex">
                <div className="rounded-full h-12 w-12 bg-slate-200 flex justify-center mt-1 mr-2">
                    <div className="flex flex-col justify-center h-full text-xl">
                        {user.firstName[0]}
                    </div>
                </div>
                <div className="flex flex-col justify-center h-ful">
                    <div>
                        {user.firstName} {user.lastName}
                    </div>
                </div>
            </div>

            <div >
                <Button onPress={(e) => {
                    navigate("/send?id=" + user._id + "&fname=" + user.firstName + "&lname=" + user.lastName);
                }} label={"Send Money"} />
            </div>
        </div>
    </div>
}