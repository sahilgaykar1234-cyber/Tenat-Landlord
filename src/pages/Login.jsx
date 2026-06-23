import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { setLoggedInUser } from "../utils/auth";
import "./Login.css";

function normalizePhone(phone) {
    if (!phone) return "";
    let cleaned = String(phone).replace(/[\s-]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
}

function Login() {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (!phone.trim()) {
            alert("Please enter your mobile number");
            return;
        }

        setLoading(true);

        try {
            const normalizedPhone = normalizePhone(phone);
            const userResponse = await axios.get("http://localhost:3001/users");
            const user = userResponse.data.find(
                (item) => normalizePhone(item.phone) === normalizedPhone
            );

            if (!user) {
                alert("User Not Registered");
                return;
            }

            setLoggedInUser(user);

            if (user.role === "Landlord") {
                navigate("/landlord-dashboard");
            } else if (user.role === "Tenant") {
                navigate("/tenant-dashboard");
            } else if (user.role === "Admin") {
                navigate("/admin-dashboard");
            } else {
                alert("Unknown user role. Please contact support.");
            }
        } catch (error) {
            console.log(error);
            alert("Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-left">
                <div className="login-left-content">
                    <h1>🏠 Property Rental</h1>
                    <p>Find, Rent and Manage Properties Easily.</p>
                </div>
            </div>

            <div className="login-right">
                <div className="login-card">
                    <h2>Login</h2>
                    <p className="login-otp-hint">
                        Enter your registered mobile number to continue.
                    </p>

                    <input
                        className="login-input"
                        type="text"
                        placeholder="e.g. +916353268656"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />

                    <button
                        className="login-btn"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>

                    <div className="register-link">
                        <Link to="/register">Register Here</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
