// backend/socket/index.js
// live updates over socket.io. every signed in tab joins the room "user:<id>", so an event
// for a user reaches all of their open tabs and nobody else's
const { Server } = require("socket.io");
const { verifyAccessToken } = require("../middleware");

let io = null;

const initRealtime = (httpServer, allowedOrigins) => {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
            credentials: true
        },
        // nothing the client sends is used except the handshake token
        maxHttpBufferSize: 1e4
    });

    // same access token as the http api. expired or missing -> the client refreshes and retries
    io.use((socket, next) => {
        try {
            const { userId } = verifyAccessToken(String(socket.handshake.auth?.token || ""));
            socket.data.userId = userId;
            next();
        } catch {
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.data.userId}`);
    });

    return io;
};

// fire and forget: realtime is a nicety, the http api stays the source of truth
const emitToUser = (userId, event, payload) => {
    if (io && userId) {
        io.to(`user:${userId}`).emit(event, payload);
    }
};

module.exports = { initRealtime, emitToUser };
