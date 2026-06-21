import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

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

        <div>

            <h1>Login</h1>

            <input
                type="text"
                placeholder="+919925229929"
                value={phone}
                onChange={(e) =>
                    setPhone(e.target.value)
                }
            />

            <br /><br />

            <button
                type="button"
                onClick={sendOtp}
            >
                Send OTP
            </button>

            <br /><br />

            <Link to="/register">
                Register Here
            </Link>

        </div>

    );

}

export default Login;