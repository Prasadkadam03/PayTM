import { useEffect, useState } from "react"
import { Button } from "./Button"
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const Users = () => {

    const [users, setUsers] = useState([]);
    const [filter , setFilter] = useState("");

    const userToken = localStorage.getItem("token");


    useEffect(() => {
        axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/bulk?filter=" + filter , {
            headers: {
              authorization: "Bearer " + userToken,
            },
          })
            .then(response => {
                setUsers(response.data.users || [])
                console.log("API " + response.data.user);
            }).catch((err)=> {
                console.log("error="+err);
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
            {users.map(user => <User key={user._id} user={user} />)}
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
                <Button onPress={(e)  => {
                    navigate("/send?id=" + user._id + "&fname=" + user.firstName + "&lname=" + user.lastName);
                }} label={"Send Money"} />
            </div>
        </div>
    </div>
}