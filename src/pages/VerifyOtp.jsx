import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import {
    getPendingRegistration,
    clearPendingRegistration
} from "../utils/auth";
import { emitUsersChanged } from "../utils/socket";
import "./VerifyOtp.css";

function normalizePhone(phone) {
    if (!phone) return "";
    let cleaned = String(phone).replace(/[\s-]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
}

function VerifyOtp() {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const pendingRegistration = getPendingRegistration();
    const verifyPhone = pendingRegistration?.phone || "";

    useEffect(() => {
        if (!pendingRegistration) {
            navigate("/register", { replace: true });
        }
    }, [pendingRegistration, navigate]);

    const verifyOtp = async () => {
        if (!otp.trim()) {
            alert("Please enter OTP");
            return;
        }

        if (!pendingRegistration) {
            navigate("/register");
            return;
        }

        setLoading(true);

        try {
            const phone = normalizePhone(verifyPhone);

            const verifyResponse = await axios.post(
                "http://localhost:5000/verify-otp",
                { phone, otp }
            );

            if (verifyResponse.data.status === "approved") {
                await axios.post("http://localhost:3001/users", {
                    name: pendingRegistration.name,
                    email: pendingRegistration.email,
                    phone: pendingRegistration.phone,
                    role: pendingRegistration.role
                });

                clearPendingRegistration();
                emitUsersChanged();
                alert("Registration successful! Please login.");
                navigate("/");
            } else {
                alert("Invalid OTP");
            }
        } catch (error) {
            console.log(error);
            alert(
                error.response?.data?.error ||
                    "OTP Verification Failed"
            );
        } finally {
            setLoading(false);
        }
    };

    if (!pendingRegistration) {
        return null;
    }

    return (
        <div className="verify-page">
            <div className="verify-left">
                <div className="verify-left-content">
                    <h1>📱 SMS OTP</h1>
                    <p>Enter the OTP sent to your mobile number.</p>
                </div>
            </div>

            <div className="verify-right">
                <div className="verify-card">
                    <h2>Verify OTP</h2>
                    <p>
                        Check SMS on{" "}
                        <strong>{verifyPhone || "your number"}</strong>
                    </p>

                    <input
                        className="verify-input"
                        type="text"
                        placeholder="Enter OTP from SMS"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                    />

                    <button
                        className="verify-btn"
                        onClick={verifyOtp}
                        disabled={loading}
                    >
                        {loading ? "Verifying..." : "Verify & Complete Registration"}
                    </button>

                    <div className="register-link">
                        <Link to="/register">← Back to Register</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VerifyOtp;
