import { AppBar } from "../Components/AppBar"
import { Balance } from "../Components/Balance"
import { Users } from "../Components/Users"


export const Dashboard = () => {
    return <div className="bg-zinc-200 min-h-screen h-full px-8">
        <AppBar />
        <div className="p-8">
            <Balance label={10000} />
            <Users />
        </div>
    </div>
} 