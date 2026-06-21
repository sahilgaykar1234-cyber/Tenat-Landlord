import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {

    const [phone, setPhone] = useState("");
const [otp, setOtp] = useState("");
const [otpSent, setOtpSent] = useState(false);
    const navigate = useNavigate();
    const sendOtp = async () => {

    try {

        const response = await axios.post(
            "http://localhost:5000/send-otp",
            {
                phone: "+916353268656"
            }
        );

        console.log(response.data);

    } catch (error) {

        console.log(error);

    }

};
    const handleLogin = async (e) => {

        e.preventDefault();

        try {

            const response = await axios.get(
                "http://localhost:3001/users"
            );

            const users = response.data;

            const user = users.find(
                (item) => item.phone === phone
            );

            if (!user) {

                alert("User Not Found");
                return;

            }

           if (user.role === "Landlord") {

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(user)
            );

            navigate("/landlord-dashboard");

        }
        else if (user.role === "Tenant") {

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(user)
            );

            navigate("/tenant-dashboard");

        }
        else if (user.role === "Admin") {

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(user)
            );

            navigate("/admin-dashboard");

        }

        }
        catch (error) {

            console.log(error);

        }

    };

    return (

        <div>

            <h1>Login</h1>

            <form onSubmit={handleLogin}>

                <input
                    type="text"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) =>
                        setPhone(e.target.value)
                    }
                />

                <br /><br />

                <button type="submit">
                    Login
                </button>

                                <button onClick={sendOtp}>
                    Send OTP
                </button>
            </form>

            <br />

            <Link to="/register">
                Register Here
            </Link>

        </div>

    );
}

export default Login;