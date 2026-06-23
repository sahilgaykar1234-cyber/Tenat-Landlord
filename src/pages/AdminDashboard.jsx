import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getLoggedInUser, clearAuth } from "../utils/auth";
import {
    emitDealsChanged,
    emitInquiriesChanged,
    emitPropertiesChanged,
    emitRentPaymentsChanged,
    emitUserDeleted,
    emitUsersChanged,
    onDealsChanged,
    onInquiriesChanged,
    onPropertiesChanged,
    onRentPaymentsChanged,
    onUsersChanged
} from "../utils/socket";
import { isDealActive } from "../utils/occupancy";
import {
    formatRentMonth,
    getCurrentRentMonth,
    hasRentPaidForMonth
} from "../utils/rent";
import UserMenu from "../components/UserMenu";
import { useTheme } from "../hooks/useTheme";
import "./AdminDashboard.css";
import "../styles/dashboard-shell.css";

const COMMISSION_RATE = 0.5;

const AI_SERVER = "http://localhost:5000";

const NAV_ITEMS = [
    { id: "overview", label: "Overview", icon: "◫" },
    { id: "tenants", label: "Tenants", icon: "◎" },
    { id: "close-deals", label: "Close Deals", icon: "✓" },
    { id: "deals", label: "All Deals", icon: "₹" },
    { id: "landlords", label: "Landlords", icon: "⌂" }
];

const AI_SUGGESTIONS = [
    "How many active tenancies are there?",
    "Which tenants have payment due?",
    "What is total admin revenue?",
    "Which inquiries are ready to close as deals?",
    "Who is living at SJ villa?"
];

const VIEW_META = {
    overview: {
        title: "Overview",
        subtitle: "Platform snapshot and quick actions"
    },
    tenants: {
        title: "Tenants & Occupancy",
        subtitle: "Who lives where and what payments are due"
    },
    "close-deals": {
        title: "Close Deals",
        subtitle: "Finalize inquiries and create platform deals"
    },
    deals: {
        title: "All Deals",
        subtitle: "Complete history of closed deals and commissions"
    },
    landlords: {
        title: "Landlords",
        subtitle: "Manage landlord accounts and listings"
    }
};

function AdminDashboard() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [user] = useState(() => getLoggedInUser() || {});
    const [activeView, setActiveView] = useState("overview");
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [landlords, setLandlords] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [deals, setDeals] = useState([]);
    const [tenantOccupancies, setTenantOccupancies] = useState([]);
    const [currentRentMonth, setCurrentRentMonth] = useState(() => getCurrentRentMonth());
    const [stats, setStats] = useState({
        landlords: 0,
        tenants: 0,
        properties: 0,
        inquiries: 0,
        revenue: 0,
        pendingCommission: 0,
        activeTenancies: 0,
        totalRentDue: 0,
        totalPaymentDue: 0
    });
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [closingInquiryId, setClosingInquiryId] = useState(null);
    const [aiMessages, setAiMessages] = useState([
        {
            role: "assistant",
            content:
                "Hi! Ask me anything — platform data, coding, general knowledge, or casual chat. I'm here to help."
        }
    ]);
    const [aiInput, setAiInput] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");
    const chatEndRef = useRef(null);

    const userName = user?.name || "Admin";
    const userInitial = userName.charAt(0).toUpperCase();

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const [usersRes, propertiesRes, inquiriesRes, dealsRes, rentPaymentsRes] =
                await Promise.all([
                    axios.get("http://localhost:3001/users"),
                    axios.get("http://localhost:3001/properties"),
                    axios.get("http://localhost:3001/inquiries"),
                    axios.get("http://localhost:3001/deals"),
                    axios.get("http://localhost:3001/rentPayments")
                ]);

            const users = usersRes.data;
            const properties = propertiesRes.data.filter((p) => p.propertyName);
            const allInquiries = inquiriesRes.data;
            const allDeals = dealsRes.data;
            const allRentPayments = rentPaymentsRes.data;
            const rentMonth = getCurrentRentMonth();

            const landlordUsers = users.filter((u) => u.role === "Landlord");
            const tenantCount = users.filter((u) => u.role === "Tenant").length;

            const landlordStats = landlordUsers.map((landlord) => {
                const landlordProperties = properties.filter(
                    (p) => p.landlordId === landlord.id
                );
                const totalRent = landlordProperties.reduce(
                    (sum, p) => sum + Number(p.rent || 0),
                    0
                );
                const inquiryCount = allInquiries.filter(
                    (i) => i.landlordId === landlord.id
                ).length;

                return {
                    ...landlord,
                    propertyCount: landlordProperties.length,
                    totalRent,
                    inquiryCount
                };
            });

            const tenantUsers = users
                .filter((u) => u.role === "Tenant")
                .map((tenant) => ({
                    ...tenant,
                    inquiryCount: allInquiries.filter((i) => i.tenantId === tenant.id).length,
                    dealCount: allDeals.filter((d) => d.tenantId === tenant.id).length
                }));

            const enrichedInquiries = allInquiries.map((inquiry) => {
                const property = properties.find(
                    (p) => p.id === inquiry.propertyId
                );
                const landlord = users.find((u) => u.id === inquiry.landlordId);
                const existingDeal = allDeals.find(
                    (d) => d.inquiryId === inquiry.id
                );

                return {
                    ...inquiry,
                    monthlyRent: Number(property?.rent || 0),
                    landlordName: landlord?.name || "Landlord",
                    commissionPreview: Math.round(
                        Number(property?.rent || 0) * COMMISSION_RATE
                    ),
                    hasDeal: Boolean(existingDeal)
                };
            });

            const revenue = allDeals
                .filter((d) => d.paymentStatus === "Paid")
                .reduce((sum, d) => sum + Number(d.commissionAmount || 0), 0);

            const pendingCommission = allDeals
                .filter((d) => d.paymentStatus !== "Paid")
                .reduce((sum, d) => sum + Number(d.commissionAmount || 0), 0);

            const occupancies = allDeals
                .map((deal) => {
                    const tenant = users.find((u) => u.id === deal.tenantId);
                    const active = isDealActive(deal);
                    const platformDue =
                        deal.paymentStatus !== "Paid"
                            ? Number(deal.commissionAmount || 0)
                            : 0;
                    const rentPaid = hasRentPaidForMonth(
                        allRentPayments,
                        deal.id,
                        rentMonth
                    );
                    const rentDue =
                        active && !rentPaid ? Number(deal.monthlyRent || 0) : 0;

                    return {
                        id: deal.id,
                        tenantName: deal.tenantName,
                        tenantEmail: tenant?.email || "—",
                        tenantPhone: tenant?.phone || "—",
                        landlordName: deal.landlordName,
                        propertyName: deal.propertyName,
                        monthlyRent: Number(deal.monthlyRent || 0),
                        isActive: active,
                        platformDue,
                        rentDue,
                        totalDue: platformDue + rentDue,
                        platformStatus: deal.paymentStatus || "Pending",
                        rentStatus: active ? (rentPaid ? "Paid" : "Due") : "—"
                    };
                })
                .sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    return b.totalDue - a.totalDue;
                });

            const activeTenancies = occupancies.filter((row) => row.isActive).length;
            const totalRentDue = occupancies.reduce((sum, row) => sum + row.rentDue, 0);
            const totalPaymentDue = occupancies.reduce((sum, row) => sum + row.totalDue, 0);

            setLandlords(landlordStats);
            setTenants(tenantUsers);
            setInquiries(enrichedInquiries);
            setDeals(allDeals);
            setTenantOccupancies(occupancies);
            setCurrentRentMonth(rentMonth);
            setStats({
                landlords: landlordUsers.length,
                tenants: tenantCount,
                properties: properties.length,
                inquiries: allInquiries.length,
                revenue,
                pendingCommission,
                activeTenancies,
                totalRentDue,
                totalPaymentDue
            });
        } catch (error) {
            console.log(error);
            alert("Could not load admin dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
        loadDashboard();
        const refresh = () => loadDashboard();
        const unsubscribers = [
            onPropertiesChanged(refresh),
            onInquiriesChanged(refresh),
            onDealsChanged(refresh),
            onRentPaymentsChanged(refresh),
            onUsersChanged(refresh)
        ];
        return () => unsubscribers.forEach((unsub) => unsub());
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [aiMessages, aiLoading, aiPanelOpen]);

    const handleAskAi = async (questionText) => {
        const question = String(questionText || aiInput).trim();
        if (!question || aiLoading) return;

        if (!user?.id) {
            setAiError("Admin session not found. Please log in again.");
            return;
        }

        const nextMessages = [...aiMessages, { role: "user", content: question }];
        setAiMessages(nextMessages);
        setAiInput("");
        setAiError("");
        setAiLoading(true);

        try {
            const history = nextMessages.slice(0, -1);
            const response = await axios.post(`${AI_SERVER}/api/admin/ai/chat`, {
                userId: user.id,
                question,
                history
            });

            setAiMessages((prev) => [
                ...prev,
                { role: "assistant", content: response.data.answer }
            ]);
        } catch (error) {
            const message =
                error.response?.data?.error ||
                error.message ||
                "Could not get AI response. Check server and API key.";
            setAiError(message);
            setAiMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Sorry, I couldn't answer that. ${message}`
                }
            ]);
        } finally {
            setAiLoading(false);
        }
    };

    const handleCloseDeal = async (inquiry) => {
        if (inquiry.hasDeal) {
            alert("Deal already closed for this inquiry.");
            return;
        }

        if (!inquiry.monthlyRent) {
            alert("Property rent not found. Cannot calculate commission.");
            return;
        }

        const commissionAmount = Math.round(inquiry.monthlyRent * COMMISSION_RATE);
        const confirmed = window.confirm(
            `Close deal for "${inquiry.propertyName}"?\n\nMonthly rent: ₹${inquiry.monthlyRent.toLocaleString()}\nTenant will pay 50%: ₹${commissionAmount.toLocaleString()}\n\nThis amount is platform revenue for admin.`
        );
        if (!confirmed) return;

        setClosingInquiryId(inquiry.id);

        try {
            await axios.post("http://localhost:3001/deals", {
                inquiryId: inquiry.id,
                propertyId: inquiry.propertyId,
                propertyName: inquiry.propertyName,
                landlordId: inquiry.landlordId,
                landlordName: inquiry.landlordName,
                tenantId: inquiry.tenantId,
                tenantName: inquiry.tenantName,
                monthlyRent: inquiry.monthlyRent,
                commissionAmount,
                commissionRate: COMMISSION_RATE,
                paidBy: "Tenant",
                paymentStatus: "Pending",
                dealStatus: "Closed",
                occupancyStatus: "Active",
                razorpayOrderId: "",
                razorpayPaymentId: "",
                createdAt: new Date().toISOString(),
                paidAt: null,
                leftAt: null
            });

            await axios.patch(`http://localhost:3001/inquiries/${inquiry.id}`, {
                status: "Deal Closed"
            });

            const otherInquiries = inquiries.filter(
                (item) =>
                    item.propertyId === inquiry.propertyId &&
                    item.id !== inquiry.id &&
                    !["Property Rented", "Tenant Left", "Deal Closed"].includes(item.status)
            );

            await Promise.all(
                otherInquiries.map((item) =>
                    axios.patch(`http://localhost:3001/inquiries/${item.id}`, {
                        status: "Property Rented"
                    })
                )
            );

            emitDealsChanged();
            emitPropertiesChanged();
            emitInquiriesChanged();
            alert("Deal closed. Tenant can now pay 50% platform fee.");
            loadDashboard();
        } catch (error) {
            console.log(error);
            alert("Could not close deal. Please try again.");
        } finally {
            setClosingInquiryId(null);
        }
    };

    const handleDeleteLandlord = async (landlord) => {
        const confirmed = window.confirm(
            `Delete landlord "${landlord.name}"?\n\nThis will also remove their ${landlord.propertyCount} propert${landlord.propertyCount === 1 ? "y" : "ies"} and related inquiries.`
        );
        if (!confirmed) return;

        setDeletingId(landlord.id);

        try {
            const [propertiesRes, favoritesRes, inquiriesRes, dealsRes] =
                await Promise.all([
                    axios.get("http://localhost:3001/properties"),
                    axios.get("http://localhost:3001/favorites"),
                    axios.get("http://localhost:3001/inquiries"),
                    axios.get("http://localhost:3001/deals")
                ]);

            const landlordPropertyIds = new Set(
                propertiesRes.data
                    .filter((p) => p.landlordId === landlord.id)
                    .map((p) => p.id)
            );

            const relatedProperties = propertiesRes.data.filter(
                (p) => p.landlordId === landlord.id
            );
            const relatedFavorites = favoritesRes.data.filter((f) =>
                landlordPropertyIds.has(f.propertyId)
            );
            const relatedInquiries = inquiriesRes.data.filter(
                (i) => i.landlordId === landlord.id
            );
            const relatedDeals = dealsRes.data.filter(
                (d) => d.landlordId === landlord.id
            );

            await Promise.all([
                axios.delete(`http://localhost:3001/users/${landlord.id}`),
                ...relatedProperties.map((p) =>
                    axios.delete(`http://localhost:3001/properties/${p.id}`)
                ),
                ...relatedFavorites.map((f) =>
                    axios.delete(`http://localhost:3001/favorites/${f.id}`)
                ),
                ...relatedInquiries.map((i) =>
                    axios.delete(`http://localhost:3001/inquiries/${i.id}`)
                ),
                ...relatedDeals.map((d) =>
                    axios.delete(`http://localhost:3001/deals/${d.id}`)
                )
            ]);

            emitUserDeleted(landlord.id);
            emitUsersChanged();
            emitPropertiesChanged();
            emitInquiriesChanged();
            emitDealsChanged();

            alert(`Landlord "${landlord.name}" deleted successfully.`);
            loadDashboard();
        } catch (error) {
            console.log(error);
            alert("Could not delete landlord. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteTenant = async (tenant) => {
        const confirmed = window.confirm(
            `Delete tenant "${tenant.name}"?\n\nThis will remove their favorites, inquiries, deals, and payment records.`
        );
        if (!confirmed) return;

        setDeletingId(tenant.id);

        try {
            const [favoritesRes, inquiriesRes, dealsRes, rentPaymentsRes] =
                await Promise.all([
                    axios.get("http://localhost:3001/favorites"),
                    axios.get("http://localhost:3001/inquiries"),
                    axios.get("http://localhost:3001/deals"),
                    axios.get("http://localhost:3001/rentPayments")
                ]);

            const relatedFavorites = favoritesRes.data.filter(
                (f) => f.tenantId === tenant.id
            );
            const relatedInquiries = inquiriesRes.data.filter(
                (i) => i.tenantId === tenant.id
            );
            const relatedDeals = dealsRes.data.filter((d) => d.tenantId === tenant.id);
            const relatedDealIds = new Set(relatedDeals.map((d) => d.id));
            const relatedRentPayments = rentPaymentsRes.data.filter(
                (payment) =>
                    payment.tenantId === tenant.id ||
                    relatedDealIds.has(payment.dealId)
            );

            await Promise.all([
                axios.delete(`http://localhost:3001/users/${tenant.id}`),
                ...relatedFavorites.map((f) =>
                    axios.delete(`http://localhost:3001/favorites/${f.id}`)
                ),
                ...relatedInquiries.map((i) =>
                    axios.delete(`http://localhost:3001/inquiries/${i.id}`)
                ),
                ...relatedDeals.map((d) =>
                    axios.delete(`http://localhost:3001/deals/${d.id}`)
                ),
                ...relatedRentPayments.map((payment) =>
                    axios.delete(`http://localhost:3001/rentPayments/${payment.id}`)
                )
            ]);

            emitUserDeleted(tenant.id);
            emitUsersChanged();
            emitInquiriesChanged();
            emitDealsChanged();
            emitRentPaymentsChanged();

            alert(`Tenant "${tenant.name}" deleted successfully.`);
            loadDashboard();
        } catch (error) {
            console.log(error);
            alert("Could not delete tenant. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleLogout = () => {
        clearAuth();
        navigate("/", { replace: true });
    };

    const handleNavClick = (viewId) => {
        setActiveView(viewId);
    };

    const openAiPanel = () => setAiPanelOpen(true);
    const closeAiPanel = () => setAiPanelOpen(false);

    const closableInquiries = inquiries.filter(
        (inquiry) =>
            !inquiry.hasDeal &&
            (inquiry.status === "Meeting Requested" ||
                inquiry.status === "Pending")
    );

    const navBadges = {
        tenants: tenantOccupancies.filter((r) => r.isActive).length,
        "close-deals": closableInquiries.length,
        deals: deals.length,
        landlords: landlords.length
    };

    const dueTenants = tenantOccupancies.filter((r) => r.totalDue > 0).slice(0, 5);
    const recentDeals = [...deals]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    const renderOverview = () => (
        <div className="admin-view">
            <div className="admin-stats-row">
                <div className="admin-stat-card">
                    <div className="admin-stat-icon blue">👤</div>
                    <div>
                        <span className="admin-stat-value">{stats.landlords}</span>
                        <span className="admin-stat-label">Landlords</span>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon green">🏠</div>
                    <div>
                        <span className="admin-stat-value">{stats.tenants}</span>
                        <span className="admin-stat-label">Tenants</span>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon purple">💰</div>
                    <div>
                        <span className="admin-stat-value">
                            ₹{stats.revenue.toLocaleString()}
                        </span>
                        <span className="admin-stat-label">Admin Revenue</span>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon orange">⏳</div>
                    <div>
                        <span className="admin-stat-value">
                            ₹{stats.pendingCommission.toLocaleString()}
                        </span>
                        <span className="admin-stat-label">Platform Pending</span>
                    </div>
                </div>
            </div>

            <div className="admin-stats-row admin-stats-row-secondary">
                <div className="admin-stat-card">
                    <div className="admin-stat-icon green">🏡</div>
                    <div>
                        <span className="admin-stat-value">{stats.activeTenancies}</span>
                        <span className="admin-stat-label">Active Tenancies</span>
                    </div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-icon orange">📅</div>
                    <div>
                        <span className="admin-stat-value">
                            ₹{stats.totalRentDue.toLocaleString()}
                        </span>
                        <span className="admin-stat-label">
                            Rent Due ({formatRentMonth(currentRentMonth)})
                        </span>
                    </div>
                </div>
                <div className="admin-stat-card highlight">
                    <div className="admin-stat-icon red">⚠️</div>
                    <div>
                        <span className="admin-stat-value">
                            ₹{stats.totalPaymentDue.toLocaleString()}
                        </span>
                        <span className="admin-stat-label">Total Payment Due</span>
                    </div>
                </div>
            </div>

            <div className="admin-overview-grid">
                <div className="admin-quick-actions">
                    <h3>Quick Actions</h3>
                    <div className="admin-action-cards">
                        <button
                            type="button"
                            className="admin-action-card"
                            onClick={() => handleNavClick("close-deals")}
                        >
                            <span className="admin-action-icon">✓</span>
                            <div>
                                <strong>Close Deals</strong>
                                <p>{closableInquiries.length} inquiries ready</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            className="admin-action-card"
                            onClick={() => handleNavClick("tenants")}
                        >
                            <span className="admin-action-icon">◎</span>
                            <div>
                                <strong>View Tenants</strong>
                                <p>{stats.activeTenancies} currently living</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            className="admin-action-card"
                            onClick={openAiPanel}
                        >
                            <span className="admin-action-icon">✦</span>
                            <div>
                                <strong>Ask AI</strong>
                                <p>Get instant answers about your platform</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            className="admin-action-card"
                            onClick={() => handleNavClick("landlords")}
                        >
                            <span className="admin-action-icon">⌂</span>
                            <div>
                                <strong>Manage Landlords</strong>
                                <p>{stats.landlords} registered</p>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>Payments Due</h3>
                        <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => handleNavClick("tenants")}
                        >
                            View all →
                        </button>
                    </div>
                    {dueTenants.length === 0 ? (
                        <p className="admin-panel-empty">No pending payments right now.</p>
                    ) : (
                        <ul className="admin-mini-list">
                            {dueTenants.map((row) => (
                                <li key={row.id}>
                                    <div>
                                        <strong>{row.tenantName}</strong>
                                        <span>{row.propertyName}</span>
                                    </div>
                                    <span className="admin-total-due">
                                        ₹{row.totalDue.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>Recent Deals</h3>
                        <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => handleNavClick("deals")}
                        >
                            View all →
                        </button>
                    </div>
                    {recentDeals.length === 0 ? (
                        <p className="admin-panel-empty">No deals closed yet.</p>
                    ) : (
                        <ul className="admin-mini-list">
                            {recentDeals.map((deal) => (
                                <li key={deal.id}>
                                    <div>
                                        <strong>{deal.propertyName}</strong>
                                        <span>{deal.tenantName}</span>
                                    </div>
                                    <span
                                        className={`admin-payment-badge payment-${(deal.paymentStatus || "Pending").toLowerCase()}`}
                                    >
                                        {deal.paymentStatus || "Pending"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );

    const renderTenants = () => (
        <div className="admin-view">
            <div className="admin-section">
                <div className="admin-section-header">
                    <div>
                        <h2>Occupancy Records</h2>
                        <p className="admin-section-desc">
                            Rent month: {formatRentMonth(currentRentMonth)}
                        </p>
                    </div>
                    <span className="admin-count-badge">
                        {tenantOccupancies.length}{" "}
                        {tenantOccupancies.length === 1 ? "record" : "records"}
                    </span>
                </div>

                {loading ? (
                    <div className="admin-empty">Loading...</div>
                ) : tenantOccupancies.length === 0 ? (
                    <div className="admin-empty">
                        <p>No tenant occupancy records yet. Close a deal to see tenant data here.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Tenant</th>
                                    <th>Contact</th>
                                    <th>Property</th>
                                    <th>Landlord</th>
                                    <th>Status</th>
                                    <th>Platform Fee</th>
                                    <th>Rent ({formatRentMonth(currentRentMonth)})</th>
                                    <th>Total Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenantOccupancies.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <div className="admin-landlord-cell">
                                                <span className="admin-landlord-avatar admin-tenant-avatar">
                                                    {(row.tenantName || "T").charAt(0).toUpperCase()}
                                                </span>
                                                <span>{row.tenantName}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-contact-cell">
                                                <span>{row.tenantPhone}</span>
                                                <span>{row.tenantEmail}</span>
                                            </div>
                                        </td>
                                        <td>{row.propertyName}</td>
                                        <td>{row.landlordName}</td>
                                        <td>
                                            <span
                                                className={`admin-occupancy-badge${row.isActive ? " living" : " left"}`}
                                            >
                                                {row.isActive ? "Living" : "Left"}
                                            </span>
                                        </td>
                                        <td>
                                            {row.platformDue > 0 ? (
                                                <span className="admin-due-amount">
                                                    Due ₹{row.platformDue.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="admin-payment-badge payment-paid">
                                                    Paid
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {!row.isActive ? (
                                                <span className="admin-muted">—</span>
                                            ) : row.rentDue > 0 ? (
                                                <span className="admin-due-amount rent">
                                                    Due ₹{row.rentDue.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="admin-payment-badge payment-paid">
                                                    Paid
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {row.totalDue > 0 ? (
                                                <strong className="admin-total-due">
                                                    ₹{row.totalDue.toLocaleString()}
                                                </strong>
                                            ) : (
                                                <span className="admin-muted">₹0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="admin-section admin-section-spaced">
                <div className="admin-section-header">
                    <div>
                        <h2>Tenant Accounts</h2>
                        <p className="admin-section-desc">
                            Registered tenants — delete removes their account and related data
                        </p>
                    </div>
                    <span className="admin-count-badge">
                        {tenants.length} {tenants.length === 1 ? "tenant" : "tenants"}
                    </span>
                </div>

                {loading ? (
                    <div className="admin-empty">Loading...</div>
                ) : tenants.length === 0 ? (
                    <div className="admin-empty">
                        <p>No tenant accounts registered yet.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Tenant</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Inquiries</th>
                                    <th>Deals</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((tenant) => (
                                    <tr key={tenant.id}>
                                        <td>
                                            <div className="admin-landlord-cell">
                                                <span className="admin-landlord-avatar admin-tenant-avatar">
                                                    {(tenant.name || "T").charAt(0).toUpperCase()}
                                                </span>
                                                <span>{tenant.name}</span>
                                            </div>
                                        </td>
                                        <td>{tenant.email || "—"}</td>
                                        <td>{tenant.phone || "—"}</td>
                                        <td>{tenant.inquiryCount}</td>
                                        <td>{tenant.dealCount}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-delete-btn"
                                                onClick={() => handleDeleteTenant(tenant)}
                                                disabled={deletingId === tenant.id}
                                            >
                                                {deletingId === tenant.id
                                                    ? "Deleting..."
                                                    : "🗑 Delete"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCloseDeals = () => (
        <div className="admin-view">
            <div className="admin-section">
                <div className="admin-section-header">
                    <div>
                        <h2>Ready to Close</h2>
                        <p className="admin-section-desc">
                            Tenant pays 50% platform fee after deal is closed
                        </p>
                    </div>
                    <span className="admin-count-badge">
                        {closableInquiries.length} ready
                    </span>
                </div>

                {loading ? (
                    <div className="admin-empty">Loading...</div>
                ) : closableInquiries.length === 0 ? (
                    <div className="admin-empty">
                        <p>No inquiries ready to close as deals.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Property</th>
                                    <th>Tenant</th>
                                    <th>Landlord</th>
                                    <th>Rent</th>
                                    <th>Tenant Pays (50%)</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closableInquiries.map((inquiry) => (
                                    <tr key={inquiry.id}>
                                        <td>{inquiry.propertyName}</td>
                                        <td>{inquiry.tenantName}</td>
                                        <td>{inquiry.landlordName}</td>
                                        <td>₹{inquiry.monthlyRent.toLocaleString()}</td>
                                        <td>₹{inquiry.commissionPreview.toLocaleString()}</td>
                                        <td>{inquiry.status}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-close-deal-btn"
                                                onClick={() => handleCloseDeal(inquiry)}
                                                disabled={closingInquiryId === inquiry.id}
                                            >
                                                {closingInquiryId === inquiry.id
                                                    ? "Closing..."
                                                    : "✓ Close Deal"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderDeals = () => (
        <div className="admin-view">
            <div className="admin-section">
                <div className="admin-section-header">
                    <div>
                        <h2>Deal History</h2>
                        <p className="admin-section-desc">
                            Platform commission from every closed deal
                        </p>
                    </div>
                    <span className="admin-count-badge">
                        {deals.length} {deals.length === 1 ? "deal" : "deals"}
                    </span>
                </div>

                {deals.length === 0 ? (
                    <div className="admin-empty">
                        <p>No deals yet. Close an inquiry to create a deal.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Property</th>
                                    <th>Landlord</th>
                                    <th>Tenant</th>
                                    <th>Rent</th>
                                    <th>Tenant Pays</th>
                                    <th>Payment</th>
                                    <th>Closed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deals.map((deal) => (
                                    <tr key={deal.id}>
                                        <td>{deal.propertyName}</td>
                                        <td>{deal.landlordName}</td>
                                        <td>{deal.tenantName}</td>
                                        <td>₹{Number(deal.monthlyRent).toLocaleString()}</td>
                                        <td>₹{Number(deal.commissionAmount).toLocaleString()}</td>
                                        <td>
                                            <span
                                                className={`admin-payment-badge payment-${(deal.paymentStatus || "Pending").toLowerCase()}`}
                                            >
                                                {deal.paymentStatus || "Pending"}
                                            </span>
                                        </td>
                                        <td>
                                            {new Date(deal.createdAt).toLocaleDateString(
                                                "en-IN",
                                                {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                }
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderLandlords = () => (
        <div className="admin-view">
            <div className="admin-section">
                <div className="admin-section-header">
                    <div>
                        <h2>Landlord Directory</h2>
                        <p className="admin-section-desc">
                            {stats.properties} properties across {landlords.length} landlords
                        </p>
                    </div>
                    <span className="admin-count-badge">
                        {landlords.length} {landlords.length === 1 ? "user" : "users"}
                    </span>
                </div>

                {loading ? (
                    <div className="admin-empty">Loading dashboard...</div>
                ) : landlords.length === 0 ? (
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👤</div>
                        <h3>No landlords yet</h3>
                        <p>Landlords will appear here once they register.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Landlord</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Properties</th>
                                    <th>Total Rent</th>
                                    <th>Inquiries</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {landlords.map((landlord) => (
                                    <tr key={landlord.id}>
                                        <td>
                                            <div className="admin-landlord-cell">
                                                <span className="admin-landlord-avatar">
                                                    {(landlord.name || "L").charAt(0).toUpperCase()}
                                                </span>
                                                <span>{landlord.name}</span>
                                            </div>
                                        </td>
                                        <td>{landlord.email || "—"}</td>
                                        <td>{landlord.phone || "—"}</td>
                                        <td>
                                            <span className="admin-pill">
                                                {landlord.propertyCount}
                                            </span>
                                        </td>
                                        <td>₹{landlord.totalRent.toLocaleString()}</td>
                                        <td>{landlord.inquiryCount}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-delete-btn"
                                                onClick={() => handleDeleteLandlord(landlord)}
                                                disabled={deletingId === landlord.id}
                                            >
                                                {deletingId === landlord.id
                                                    ? "Deleting..."
                                                    : "🗑 Delete"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAiDrawer = () => {
        if (!aiPanelOpen) return null;

        return (
        <>
            <button
                type="button"
                className="admin-ai-backdrop open"
                aria-label="Close AI assistant"
                onClick={closeAiPanel}
            />

            <aside className="admin-ai-drawer open" aria-hidden={false}>
                <div className="admin-ai-drawer-header">
                    <div>
                        <span className="admin-ai-drawer-icon">✦</span>
                        <div>
                            <h2>Ask AI</h2>
                            <p>Platform data, coding, or general questions</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="admin-ai-drawer-close"
                        aria-label="Close"
                        onClick={closeAiPanel}
                    >
                        ×
                    </button>
                </div>

                <div className="admin-ai-drawer-suggestions">
                    {AI_SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion}
                            type="button"
                            className="admin-ai-suggestion"
                            onClick={() => handleAskAi(suggestion)}
                            disabled={aiLoading}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>

                <div className="admin-ai-chat admin-ai-chat-drawer">
                    <div className="admin-ai-messages">
                        {aiMessages.map((message, index) => (
                            <div
                                key={`${message.role}-${index}`}
                                className={`admin-ai-message ${message.role}`}
                            >
                                <div className="admin-ai-message-avatar">
                                    {message.role === "assistant" ? "✦" : userInitial}
                                </div>
                                <div className="admin-ai-message-bubble">
                                    <span className="admin-ai-message-label">
                                        {message.role === "assistant" ? "AI Assistant" : userName}
                                    </span>
                                    <p>{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {aiLoading && (
                            <div className="admin-ai-message assistant">
                                <div className="admin-ai-message-avatar">✦</div>
                                <div className="admin-ai-message-bubble typing">
                                    <span className="admin-ai-message-label">AI Assistant</span>
                                    <p>
                                        <span className="admin-ai-typing-dots">
                                            <span />
                                            <span />
                                            <span />
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {aiError && <div className="admin-ai-error-banner">{aiError}</div>}

                    <form
                        className="admin-ai-input-row"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleAskAi();
                        }}
                    >
                        <input
                            type="text"
                            value={aiInput}
                            onChange={(event) => setAiInput(event.target.value)}
                            placeholder="Ask anything..."
                            disabled={aiLoading}
                        />
                        <button type="submit" disabled={aiLoading || !aiInput.trim()}>
                            {aiLoading ? "..." : "Send"}
                        </button>
                    </form>
                </div>
            </aside>
        </>
        );
    };

    const renderActiveView = () => {
        switch (activeView) {
            case "tenants":
                return renderTenants();
            case "close-deals":
                return renderCloseDeals();
            case "deals":
                return renderDeals();
            case "landlords":
                return renderLandlords();
            default:
                return renderOverview();
        }
    };

    const viewMeta = VIEW_META[activeView] || VIEW_META.overview;

    return (
        <div className="dash-app" data-theme={theme}>
            <header className="dash-header">
                <div className="dash-header-top">
                    <div className="dash-brand">
                        <div className="dash-brand-mark">
                            <span>PM</span>
                        </div>
                        <div className="dash-brand-text">
                            <strong>PropManager</strong>
                            <span>Admin workspace</span>
                        </div>
                    </div>

                    <div className="dash-header-actions">
                        <div className="dash-live-pill">
                            <span className="dash-live-dot" />
                            Live sync
                        </div>
                        <UserMenu
                            userName={userName}
                            userRole="Administrator"
                            userInitial={userInitial}
                            theme={theme}
                            onToggleTheme={toggleTheme}
                            onLogout={handleLogout}
                        />
                    </div>
                </div>

                <nav className="dash-nav-rail" aria-label="Admin sections">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`dash-nav-pill${activeView === item.id ? " active" : ""}`}
                            onClick={() => handleNavClick(item.id)}
                        >
                            <span className="dash-nav-pill-icon">{item.icon}</span>
                            <span className="dash-nav-pill-label">{item.label}</span>
                            {navBadges[item.id] > 0 && (
                                <span className="dash-nav-pill-badge">{navBadges[item.id]}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="dash-page">
                <div className="dash-page-intro">
                    <div>
                        <p className="dash-page-eyebrow">Dashboard</p>
                        <h1>{viewMeta.title}</h1>
                        <p className="dash-page-subtitle">{viewMeta.subtitle}</p>
                    </div>
                </div>

                <div className="dash-page-body">{renderActiveView()}</div>
            </main>

            {!aiPanelOpen && (
                <button
                    type="button"
                    className="admin-chat-fab"
                    onClick={openAiPanel}
                    aria-label="Ask AI assistant"
                >
                    <span className="admin-chat-fab-ring" aria-hidden="true" />
                    <span className="admin-chat-fab-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M7.5 18.5L4 20V6.5C4 5.12 5.12 4 6.5 4H17.5C18.88 4 20 5.12 20 6.5V14.5C20 15.88 18.88 17 17.5 17H9.8L7.5 18.5Z"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinejoin="round"
                            />
                            <circle cx="9" cy="10.5" r="1" fill="currentColor" />
                            <circle cx="12" cy="10.5" r="1" fill="currentColor" />
                            <circle cx="15" cy="10.5" r="1" fill="currentColor" />
                        </svg>
                    </span>
                    <span className="admin-chat-fab-tooltip">Ask AI</span>
                </button>
            )}

            {renderAiDrawer()}
        </div>
    );
}

export default AdminDashboard;
