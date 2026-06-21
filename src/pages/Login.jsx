import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";

function Login() {

    const [phone, setPhone] = useState("");
    const navigate = useNavigate();

    const sendOtp = async () => {

        try {

            const response = await axios.post(
                "http://localhost:5000/send-otp",
                {
                    phone
                }
            );

            if (response.data.success) {

                localStorage.setItem(
                    "loginPhone",
                    phone
                );

                alert("OTP Sent Successfully");

                navigate("/verify-otp");

            }

        } catch (error) {

            console.log(error);

            alert("Failed To Send OTP");

        }

    };

    return (
    <div className="login-page">

        <div className="login-left">

            <div className="login-left-content">

                <h1>
                    🏠 Property Rental
                </h1>

                <p>
                    Find, Rent and Manage
                    Properties Easily.
                </p>

            </div>

        </div>

        <div className="login-right">

            <div className="login-card">

                <h2>Login</h2>

                <input
                    className="login-input"
                    type="text"
                    placeholder="Enter Mobile Number"
                    value={phone}
                    onChange={(e) =>
                        setPhone(e.target.value)
                    }
                />

                <button
                    className="login-btn"
                    onClick={sendOtp}
                >
                    Send OTP
                </button>

                <div className="register-link">

                    <Link to="/register">
                        Register Here
                    </Link>

                </div>

            </div>

        </div>

    </div>
);

}

export default Login;