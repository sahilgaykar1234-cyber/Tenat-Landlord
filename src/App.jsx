import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import LandlordDashboard from "./pages/LandlordDashboard";
import TenantDashboard from "./pages/TenantDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

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

                <Route
                    path="/landlord-dashboard"
                    element={
                        <ProtectedRoute allowedRole="Landlord">
                            <LandlordDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/tenant-dashboard"
                    element={
                        <ProtectedRoute allowedRole="Tenant">
                            <TenantDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin-dashboard"
                    element={
                        <ProtectedRoute allowedRole="Admin">
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/verify-otp"
                    element={<VerifyOtp />}
                />
            </Routes>

        </BrowserRouter>

    );

}

export default App;