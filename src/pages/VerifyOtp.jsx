import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./VerifyOtp.css";

function VerifyOtp() {

    const [otp, setOtp] = useState("");

    const navigate = useNavigate();

    const verifyOtp = async () => {

        try {

            const phone =
                localStorage.getItem(
                    "loginPhone"
                );

            const verifyResponse =
                await axios.post(
                    "http://localhost:5000/verify-otp",
                    {
                        phone,
                        otp
                    }
                );

            if (
                verifyResponse.data.status ===
                "approved"
            ) {

                const userResponse =
                    await axios.get(
                        "http://localhost:3001/users"
                    );

                const users =
                    userResponse.data;

                const user = users.find(
                    (item) =>
                        item.phone === phone
                );

                if (!user) {

                    alert(
                        "User Not Registered"
                    );

                    return;

                }

                localStorage.setItem(
                    "loggedInUser",
                    JSON.stringify(user)
                );

                if (
                    user.role ===
                    "Landlord"
                ) {

                    navigate(
                        "/landlord-dashboard"
                    );

                }
                else if (
                    user.role ===
                    "Tenant"
                ) {

                    navigate(
                        "/tenant-dashboard"
                    );

                }
                else {

                    navigate(
                        "/admin-dashboard"
                    );

                }

            }
            else {

                alert("Invalid OTP");

            }

        } catch (error) {

            console.log(error);

            alert(
                "OTP Verification Failed"
            );

        }

    };

    return (

    <div className="verify-page">

        <div className="verify-left">

            <div className="verify-left-content">

                <h1>
                    🔐 OTP Verification
                </h1>

                <p>
                    Enter the OTP sent to your
                    registered mobile number.
                </p>

            </div>

        </div>

        <div className="verify-right">

            <div className="verify-card">

                <h2>Verify OTP</h2>

                <p>
                    Please enter the OTP
                    received on your phone.
                </p>

                <input
                    className="verify-input"
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) =>
                        setOtp(e.target.value)
                    }
                />

                <button
                    className="verify-btn"
                    onClick={verifyOtp}
                >
                    Verify OTP
                </button>

            </div>

        </div>

    </div>

);

}

export default VerifyOtp;