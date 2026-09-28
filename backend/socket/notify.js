// backend/socket/notify.js
// what each side of an action is told in real time
const { User } = require("../db");
const { emitToUser } = require("./index");

const firstNames = async (...ids) => {
    const users = await User.find({ _id: { $in: ids.filter(Boolean) } }).select("firstName").lean();
    return new Map(users.map(u => [String(u._id), u.firstName]));
};

// money moved: both people get the new transaction and a nudge to reload their balance
const notifyTransaction = async (transaction) => {
    try {
        const names = await firstNames(transaction.from, transaction.to);
        const base = { transactionId: transaction._id, amount: transaction.amount, type: transaction.type };
        if (transaction.from) {
            emitToUser(transaction.from, "transaction:new", { ...base, direction: "sent", name: names.get(String(transaction.to)) });
            emitToUser(transaction.from, "balance:updated", {});
        }
        emitToUser(transaction.to, "transaction:new", { ...base, direction: "received", name: names.get(String(transaction.from)) || null });
        emitToUser(transaction.to, "balance:updated", {});
    } catch (err) {
        console.error("realtime notify failed", err.message);
    }
};

const notifyRequestCreated = async (request) => {
    try {
        const names = await firstNames(request.from);
        emitToUser(request.to, "request:new", { requestId: request._id, amount: request.amount, name: names.get(String(request.from)) });
    } catch (err) {
        console.error("realtime notify failed", err.message);
    }
};

// tells the other person what happened to a request (paid / declined / cancelled)
const notifyRequestUpdated = (request, status, otherUserId) => {
    emitToUser(otherUserId, "request:updated", { requestId: request._id, status, amount: request.amount });
};

const notifySecurity = (userId, message) => emitToUser(userId, "security:alert", { message });

module.exports = { notifyTransaction, notifyRequestCreated, notifyRequestUpdated, notifySecurity };
