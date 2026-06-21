import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import LandlordDashboard from "./pages/LandlordDashboard";
// import TenantDashboard from "./pages/TenantDashboard";
// import AdminDashboard from "./pages/AdminDashboard";

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />

                { <Route
                    path="/landlord-dashboard"
                    element={<LandlordDashboard />}
                />

                /* <Route
                    path="/tenant-dashboard"
                    element={<TenantDashboard />}
                />

                <Route
                    path="/admin-dashboard"
                    element={<AdminDashboard />}
                /> */}

            </Routes>

        </BrowserRouter>

    );

}

export default App;