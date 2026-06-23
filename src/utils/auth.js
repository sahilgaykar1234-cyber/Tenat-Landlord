const USER_KEY = "loggedInUser";
const PHONE_KEY = "loginPhone";
const PENDING_REG_KEY = "pendingRegistration";

// sessionStorage = har browser tab ka apna alag session (landlord + tenant dono tabs mein)

function clearLegacyLocalAuth() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PHONE_KEY);
}

export function getLoggedInUser() {
    try {
        const user = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
        return user?.id ? user : null;
    } catch {
        return null;
    }
}

export function setLoggedInUser(user) {
    clearLegacyLocalAuth();
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getLoginPhone() {
    return sessionStorage.getItem(PHONE_KEY);
}

export function setLoginPhone(phone) {
    sessionStorage.setItem(PHONE_KEY, phone);
}

export function clearAuth() {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PHONE_KEY);
    sessionStorage.removeItem(PENDING_REG_KEY);
    clearLegacyLocalAuth();
}

export function setPendingRegistration(data) {
    sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(data));
}

export function getPendingRegistration() {
    try {
        const data = JSON.parse(sessionStorage.getItem(PENDING_REG_KEY) || "null");
        return data?.phone ? data : null;
    } catch {
        return null;
    }
}

export function clearPendingRegistration() {
    sessionStorage.removeItem(PENDING_REG_KEY);
}
