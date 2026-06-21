import { useState, useEffect } from "react";
import axios from "axios";
import "./LandlordDashboard.css";

function LandlordDashboard() {

    const [propertyData, setPropertyData] = useState({
        propertyName: "",
        address: "",
        propertyType: "",
        rent: ""
    });

    const [properties, setProperties] = useState([]);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {

        loadProperties();

    }, []);

    const loadProperties = async () => {

        try {

            const loggedInUser = JSON.parse(
                localStorage.getItem("loggedInUser")
            );

            const response = await axios.get(
                "http://localhost:3001/properties"
            );

            const myProperties =
                response.data.filter(
                    (property) =>
                        property.landlordId ===
                        loggedInUser.id
                );

            setProperties(myProperties);

        }
        catch (error) {

            console.log(error);

        }

    };

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

            const property = {
                ...propertyData,
                landlordId: loggedInUser.id
            };

            await axios.post(
                "http://localhost:3001/properties",
                property
            );

            alert(
                "Property Registered Successfully"
            );

            setPropertyData({
                propertyName: "",
                address: "",
                propertyType: "",
                rent: ""
            });

            loadProperties();

        }
        catch (error) {

            console.log(error);

            alert(
                "Something Went Wrong"
            );

        }

    };

    return (
        <div className="dashboard-header">

            <h1>
                Welcome,
                {
                    JSON.parse(
                        localStorage.getItem(
                            "loggedInUser"
                        )
                    ).name
                }
            </h1>

            <button
                className="add-property-btn"
                onClick={() =>
                    setShowForm(!showForm)
                }
            >
                {
                    showForm
                        ? "Close Form"
                        : "+ Add Property"
                }
            </button>

            {
                showForm && (

                    <form
                        className="property-form"
                        onSubmit={handleSubmit}
                    >

                        <input
                            type="text"
                            name="propertyName"
                            placeholder="Property Name"
                            value={
                                propertyData.propertyName
                            }
                            onChange={handleChange}
                        />

                        <input
                            type="text"
                            name="address"
                            placeholder="Property Address"
                            value={
                                propertyData.address
                            }
                            onChange={handleChange}
                        />

                        <select
                            name="propertyType"
                            value={
                                propertyData.propertyType
                            }
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

                        <input
                            type="number"
                            name="rent"
                            placeholder="Monthly Rent"
                            value={
                                propertyData.rent
                            }
                            onChange={handleChange}
                        />

                        <button type="submit">
                            Register Property
                        </button>

                    </form>

                )
            }

            <h2 className="my-properties-header">
                My Properties
            </h2>

            {
                properties.length === 0 ? (

                    <p>
                        No Properties Found
                    </p>

                ) : (
                    <div className="property-grid">
                        {properties.map(
                            (property) => {
                                return (

                                    <div
                                        key={property.id}
                                        className="property-card"
                                    >

                                        <h3>
                                            {property.propertyName}
                                        </h3>

                                        <p>
                                            📍
                                            {property.address}
                                        </p>

                                        <p>
                                            🏠
                                            {property.propertyType}
                                        </p>

                                        <p>
                                            💰 ₹
                                            {property.rent}/month
                                        </p>

                                        <div
                                            className="property-actions"
                                        >

                                            <button className="edit-btn">
                                                Edit
                                            </button>

                                            <button className="delete-btn">
                                                Delete
                                            </button>

                                        </div>

                                    </div>

                                );
                            }
                        )}
                    </div>
                )
            }

        </div>
    );

}

export default LandlordDashboard;