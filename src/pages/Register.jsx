import { useState } from "react";
import axios from "axios";

function Register() {

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        role: ""
    });

    const handleChange = (e) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            await axios.post(
                "http://localhost:3001/users",
                formData
            );

            alert("User Registered");

            setFormData({
                name: "",
                email: "",
                phone: "",
                role: ""
            });

        } catch (error) {

            console.log(error);

        }

    };

    return (

        <form onSubmit={handleSubmit}>

            <input
                type="text"
                name="name"
                placeholder="Name"
                value={formData.name}
                onChange={handleChange}
            />

            <br /><br />

            <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
            />

            <br /><br />

            <input
                type="text"
                name="phone"
                placeholder="Phone"
                value={formData.phone}
                onChange={handleChange}
            />

            <br /><br />

            <select
                name="role"
                value={formData.role}
                onChange={handleChange}
            >
                <option value="">
                    Select Role
                </option>

                <option value="Tenant">
                    Tenant
                </option>

                <option value="Landlord">
                    Landlord
                </option>
            </select>

            <br /><br />

            <button type="submit">
                Register
            </button>

        </form>

    );
}

export default Register;