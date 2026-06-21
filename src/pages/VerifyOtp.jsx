import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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

        <div>

            <h1>Verify OTP</h1>

            <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) =>
                    setOtp(e.target.value)
                }
            />

            <br /><br />

            <button
                onClick={verifyOtp}
            >
                Verify OTP
            </button>

        </div>

    );

}

export default VerifyOtp;