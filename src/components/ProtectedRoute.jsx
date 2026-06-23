import { useEffect, useCallback } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { getLoggedInUser, clearAuth } from "../utils/auth";
import { onUserDeleted } from "../utils/socket";

function ProtectedRoute({ children, allowedRole }) {
    const navigate = useNavigate();
    const user = getLoggedInUser();
    const isAuthorized = user && (!allowedRole || user.role === allowedRole);

    const redirectToLogin = useCallback(
        (message) => {
            if (message) {
                alert(message);
            }
            clearAuth();
            navigate("/", { replace: true });
        },
        [navigate]
    );

    useEffect(() => {
        if (!isAuthorized || !user?.id) return;

        axios
            .get(`http://localhost:3001/users/${user.id}`)
            .catch(() => {
                redirectToLogin("Your account is no longer available. Please contact support.");
            });
    }, [isAuthorized, user?.id, redirectToLogin]);

    useEffect(() => {
        if (!isAuthorized) return;

        const unsubUserDeleted = onUserDeleted((deletedUserId) => {
            const currentUser = getLoggedInUser();
            if (currentUser?.id === deletedUserId) {
                redirectToLogin("Your account has been removed by the administrator.");
            }
        });

        const handlePageShow = (event) => {
            if (event.persisted && !getLoggedInUser()) {
                redirectToLogin();
            }
        };

        window.addEventListener("pageshow", handlePageShow);
        return () => {
            unsubUserDeleted();
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, [isAuthorized, redirectToLogin]);

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default ProtectedRoute;
