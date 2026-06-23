import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

let socket = null;

export function getSocket() {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: true,
            transports: ["websocket", "polling"]
        });
    }
    return socket;
}

export function emitPropertiesChanged() {
    getSocket().emit("properties:changed");
}

export function emitInquiriesChanged() {
    getSocket().emit("inquiries:changed");
}

export function emitDealsChanged() {
    getSocket().emit("deals:changed");
}

export function emitRentPaymentsChanged() {
    getSocket().emit("rentPayments:changed");
}

export function emitUserDeleted(userId) {
    getSocket().emit("user:deleted", userId);
}

export function emitUsersChanged() {
    getSocket().emit("users:changed");
}

export function onPropertiesChanged(callback) {
    const s = getSocket();
    s.on("properties:changed", callback);
    return () => s.off("properties:changed", callback);
}

export function onInquiriesChanged(callback) {
    const s = getSocket();
    s.on("inquiries:changed", callback);
    return () => s.off("inquiries:changed", callback);
}

export function onDealsChanged(callback) {
    const s = getSocket();
    s.on("deals:changed", callback);
    return () => s.off("deals:changed", callback);
}

export function onRentPaymentsChanged(callback) {
    const s = getSocket();
    s.on("rentPayments:changed", callback);
    return () => s.off("rentPayments:changed", callback);
}

export function onUserDeleted(callback) {
    const s = getSocket();
    s.on("user:deleted", callback);
    return () => s.off("user:deleted", callback);
}

export function onUsersChanged(callback) {
    const s = getSocket();
    s.on("users:changed", callback);
    return () => s.off("users:changed", callback);
}
