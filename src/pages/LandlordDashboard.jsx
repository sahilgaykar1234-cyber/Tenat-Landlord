import { useState } from "react";
import axios from "axios";

function LandlordDashboard() {

    const [propertyData, setPropertyData] = useState({
        propertyName: "",
        address: "",
        propertyType: "",
        rent: ""
    });

    const handleChange = (e) => {

        setPropertyData({
            ...propertyData,
            [e.target.name]: e.target.value
        });

    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            const loggedInUser = JSON.parse(
                localStorage.getItem("loggedInUser")
            );
            console.log("loggedInUser =>", loggedInUser);
            const property = {
                ...propertyData,
                landlordId: loggedInUser.id
            };

            await axios.post(
                "http://localhost:3001/properties",
                property
            );

            alert("Property Registered Successfully");

            setPropertyData({
                propertyName: "",
                address: "",
                propertyType: "",
                rent: ""
            });

        } catch (error) {

            console.log(error);

            alert("Something went wrong");

        }

    };

    return (

        <div>

            <h1>Landlord Dashboard</h1>

            <h2>Add Property</h2>

            <form onSubmit={handleSubmit}>

                <input
                    type="text"
                    name="propertyName"
                    placeholder="Property Name"
                    value={propertyData.propertyName}
                    onChange={handleChange}
                />

                <br /><br />

                <input
                    type="text"
                    name="address"
                    placeholder="Property Address"
                    value={propertyData.address}
                    onChange={handleChange}
                />

                <br /><br />

                <select
                    name="propertyType"
                    value={propertyData.propertyType}
                    onChange={handleChange}
                >

                    <option value="">
                        Select Property Type
                    </option>

                    <option value="Villa">
                        Villa
                    </option>

                    <option value="Apartment">
                        Apartment
                    </option>

                    <option value="Row House">
                        Row House
                    </option>

                </select>

                <br /><br />

                <input
                    type="number"
                    name="rent"
                    placeholder="Monthly Rent"
                    value={propertyData.rent}
                    onChange={handleChange}
                />

                <br /><br />

                <button type="submit">
                    Register Property
                </button>

            </form>

        </div>

    );
}

export default LandlordDashboard;