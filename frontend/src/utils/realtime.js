import axios from "axios";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { formatINR } from "./money";

// one socket per tab. pages listen for the "paytm:refresh" window event and reload their data
let socket = null;
let lastRetry = 0;

const refreshPages = () => window.dispatchEvent(new Event("paytm:refresh"));

export const startRealtime = () => {
    if (socket || !localStorage.getItem("token")) return;

    socket = io(import.meta.env.VITE_SERVER_URL, {
        // read on every (re)connect, so a refreshed token is picked up
        auth: (cb) => cb({ token: localStorage.getItem("token") }),
        withCredentials: true,
    });

    socket.on("transaction:new", (t) => {
        if (t.direction === "received") {
            toast.success(t.type === "topup"
                ? `${formatINR(t.amount)} added to your wallet`
                : `${formatINR(t.amount)} received from ${t.name || "someone"}`);
        }
        refreshPages();
    });
    socket.on("balance:updated", refreshPages);
    socket.on("request:new", (r) => {
        toast.info(`${r.name} asked you for ${formatINR(r.amount)}`);
        refreshPages();
    });
    socket.on("request:updated", (r) => {
        toast.info(`Your request for ${formatINR(r.amount)} was ${r.status}`);
        refreshPages();
    });
    socket.on("security:alert", (a) => toast.warn(a.message, { autoClose: false }));

    // the access token expired: any api call makes axios refresh it, then connect again.
    // at most once every 30s so a dead session can't loop
    socket.on("connect_error", async (err) => {
        if (err.message !== "unauthorized" || Date.now() - lastRetry < 30000) return;
        lastRetry = Date.now();
        try {
            await axios.get(import.meta.env.VITE_SERVER_URL + "/api/v1/user/getUser", {
                headers: { authorization: "Bearer " + localStorage.getItem("token") },
            });
            socket?.connect();
        } catch {
            // the axios interceptor already sent the user to signin
        }
    });
};

export const stopRealtime = () => {
    socket?.disconnect();
    socket = null;
};
