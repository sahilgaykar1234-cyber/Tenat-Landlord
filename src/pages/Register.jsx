import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { setPendingRegistration } from "../utils/auth";
import "./Register.css";

function normalizePhone(phone) {
    if (!phone) return "";
    let cleaned = String(phone).replace(/[\s-]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
}

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        role: ""
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const normalizedPhone = normalizePhone(formData.phone);
            const userResponse = await axios.get("http://localhost:3001/users");
            const users = userResponse.data;

            const phoneTaken = users.some(
                (user) => normalizePhone(user.phone) === normalizedPhone
            );
            const emailTaken = users.some(
                (user) =>
                    user.email?.toLowerCase() === formData.email.trim().toLowerCase()
            );

            if (phoneTaken || emailTaken) {
                alert("Phone or email already registered");
                return;
            }

            const response = await axios.post("http://localhost:5000/send-otp", {
                phone: normalizedPhone
            });

            if (response.data.success) {
                setPendingRegistration({
                    ...formData,
                    phone: normalizedPhone
                });
                alert("OTP sent to your mobile number!");
                navigate("/verify-otp");
            }
        } catch (error) {
            console.log(error);
            alert(
                error.response?.data?.error ||
                    "Failed to send OTP. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-left">
                <div className="register-left-content">
                    <h1>🏠 Property Rental</h1>
                    <p>
                        Create your account and start finding
                        or listing properties today.
                    </p>
                </div>
            </div>

            <div className="register-right">
                <div className="register-card">
                    <h2>Create Account</h2>
                    <p className="register-subtitle">
                        Fill in your details — we will verify your number via SMS OTP.
                    </p>

                    <form className="register-form" onSubmit={handleSubmit}>
                        <div className="register-field">
                            <label htmlFor="name">Full Name</label>
                            <input
                                id="name"
                                className="register-input"
                                type="text"
                                name="name"
                                placeholder="Enter your name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="register-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                className="register-input"
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="register-field">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                id="phone"
                                className="register-input"
                                type="text"
                                name="phone"
                                placeholder="e.g. +91XXXXXXXXXX"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="register-field">
                            <label htmlFor="role">Register As</label>
                            <select
                                id="role"
                                className="register-input register-select"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select your role</option>
                                <option value="Tenant">Tenant</option>
                                <option value="Landlord">Landlord</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="register-btn"
                            disabled={loading}
                        >
                            {loading ? "Sending OTP..." : "Send OTP & Register"}
                        </button>
                    </form>

                    <div className="login-link">
                        Already have an account?{" "}
                        <Link to="/">Login Here</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;
