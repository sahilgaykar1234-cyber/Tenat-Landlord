import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getLoggedInUser, clearAuth, setLoggedInUser } from "../utils/auth";
import { emitPropertiesChanged, emitInquiriesChanged, onInquiriesChanged, onDealsChanged, onRentPaymentsChanged, emitUsersChanged } from "../utils/socket";
import { readImageAsDataUrl } from "../utils/images";
import { getActiveDealForProperty } from "../utils/occupancy";
import { formatRentMonth, getCurrentRentMonth } from "../utils/rent";
import UserMenu from "../components/UserMenu";
import ProfileModal from "../components/ProfileModal";
import "../components/ProfileModal.css";
import { useTheme } from "../hooks/useTheme";
import "./LandlordDashboard.css";
import "../styles/dashboard-shell.css";

const MAX_PHOTOS = 6;

function LandlordDashboard() {

    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const [user, setUser] = useState(() => getLoggedInUser() || {});
    const [showProfileModal, setShowProfileModal] = useState(false);

    const [propertyData, setPropertyData] = useState({
        propertyName: "",
        address: "",
        propertyType: "",
        rent: "",
        photos: []
    });

    const [properties, setProperties] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [deals, setDeals] = useState([]);
    const [rentPayments, setRentPayments] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [modalPhotoIndex, setModalPhotoIndex] = useState(0);

    const emptyProperty = {
        propertyName: "",
        address: "",
        propertyType: "",
        rent: "",
        photos: []
    };

    const userName = user?.name || "User";
    const userInitial = userName.charAt(0).toUpperCase();

    useEffect(() => {
        loadProperties();
        const unsubInquiries = onInquiriesChanged(() => {
            loadProperties();
        });
        const unsubDeals = onDealsChanged(() => {
            loadProperties();
        });
        const unsubRentPayments = onRentPaymentsChanged(() => {
            loadProperties();
        });
        return () => {
            unsubInquiries();
            unsubDeals();
            unsubRentPayments();
        };
    }, []);

    useEffect(() => {
        if (!selectedProperty) return;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSelectedProperty(null);
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedProperty]);

    const openPropertyModal = (property) => {
        setSelectedProperty(property);
        setModalPhotoIndex(0);
    };

    const closePropertyModal = () => {
        setSelectedProperty(null);
        setModalPhotoIndex(0);
    };

    const modalProperty = selectedProperty
        ? properties.find((property) => property.id === selectedProperty.id) || selectedProperty
        : null;

    const loadProperties = async () => {
        if (!user?.id) return;
        try {
            const [propertiesRes, inquiriesRes, usersRes, dealsRes, rentPaymentsRes] = await Promise.all([
                axios.get("http://localhost:3001/properties"),
                axios.get("http://localhost:3001/inquiries"),
                axios.get("http://localhost:3001/users"),
                axios.get("http://localhost:3001/deals"),
                axios.get("http://localhost:3001/rentPayments")
            ]);

            const myProperties = propertiesRes.data.filter(
                (p) => p.landlordId === user.id && p.propertyName
            );
            const myPropertyIds = new Set(myProperties.map((p) => p.id));
            const myInquiries = inquiriesRes.data
                .filter((i) => myPropertyIds.has(i.propertyId))
                .map((inquiry) => {
                    const tenant = usersRes.data.find((u) => u.id === inquiry.tenantId);
                    return {
                        ...inquiry,
                        tenantEmail: inquiry.tenantEmail || tenant?.email || "",
                        tenantPhone: inquiry.tenantPhone || tenant?.phone || "",
                        tenantName: inquiry.tenantName || tenant?.name || "Tenant"
                    };
                });

            setProperties(myProperties);
            setInquiries(myInquiries);
            setDeals(dealsRes.data);

            const myRentPayments = rentPaymentsRes.data
                .filter((payment) => payment.landlordId === user.id && payment.status === "Paid")
                .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

            setRentPayments(myRentPayments);
        } catch (error) {
            console.log(error);
        }
    };

    const getPropertyInquiries = (propertyId) =>
        inquiries.filter((i) => i.propertyId === propertyId);

    const getPropertyRentPayments = (propertyId) =>
        rentPayments.filter((payment) => payment.propertyId === propertyId);

    const currentRentMonth = getCurrentRentMonth();
    const rentReceivedThisMonth = rentPayments
        .filter((payment) => payment.paidForMonth === currentRentMonth)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalRentReceived = rentPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
    );

    const handleProfileSave = async (form) => {
        try {
            const updatedUser = {
                ...user,
                name: form.name,
                email: form.email,
                phone: form.phone
            };
            await axios.put(`http://localhost:3001/users/${user.id}`, updatedUser);
            setLoggedInUser(updatedUser);
            setUser(updatedUser);
            emitUsersChanged();
        } catch (error) {
            console.log(error);
            alert("Failed to update profile. Please try again.");
            throw error;
        }
    };

    const handleLogout = () => {
        clearAuth();
        navigate("/", { replace: true });
    };

    const handleChange = (e) => {
        setPropertyData({ ...propertyData, [e.target.name]: e.target.value });
    };

    const resetForm = () => {
        setPropertyData(emptyProperty);
        setEditingId(null);
        setShowForm(false);
    };

    const handlePhotoChange = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";

        if (!files.length) return;

        const remainingSlots = MAX_PHOTOS - propertyData.photos.length;
        if (remainingSlots <= 0) {
            alert(`You can upload up to ${MAX_PHOTOS} photos.`);
            return;
        }

        setPhotoUploading(true);

        try {
            const selectedFiles = files.slice(0, remainingSlots);
            const newPhotos = await Promise.all(
                selectedFiles.map((file) => readImageAsDataUrl(file))
            );

            setPropertyData((prev) => ({
                ...prev,
                photos: [...prev.photos, ...newPhotos]
            }));
        } catch (error) {
            alert(error.message || "Could not upload photo.");
        } finally {
            setPhotoUploading(false);
        }
    };

    const removePhoto = (index) => {
        setPropertyData((prev) => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const openAddForm = () => {
        setPropertyData(emptyProperty);
        setEditingId(null);
        setShowForm(true);
    };

    const handleEdit = (property) => {
        setPropertyData({
            propertyName: property.propertyName || "",
            address: property.address || "",
            propertyType: property.propertyType || "",
            rent: property.rent || "",
            photos: property.photos || []
        });
        setEditingId(property.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.put(`http://localhost:3001/properties/${editingId}`, {
                    ...propertyData,
                    id: editingId,
                    landlordId: user.id
                });
            } else {
                const property = { ...propertyData, landlordId: user.id };
                await axios.post("http://localhost:3001/properties", property);
            }
            resetForm();
            loadProperties();
            emitPropertiesChanged();
        } catch (error) {
            console.log(error);
            alert("Something went wrong. Please try again.");
        }
    };

    const handleDelete = async (id) => {
        const activeDeal = getActiveDealForProperty(id, deals);
        if (activeDeal) {
            alert(
                `Cannot remove "${activeDeal.propertyName}" while ${activeDeal.tenantName} is still renting it.\n\nThe tenant must leave the property first.`
            );
            return;
        }

        if (!window.confirm("Are you sure you want to remove this property?")) return;
        try {
            const [favoritesRes, inquiriesRes, rentPaymentsRes] = await Promise.all([
                axios.get("http://localhost:3001/favorites"),
                axios.get("http://localhost:3001/inquiries"),
                axios.get("http://localhost:3001/rentPayments")
            ]);

            const relatedFavorites = favoritesRes.data.filter(
                (f) => f.propertyId === id
            );
            const relatedInquiries = inquiriesRes.data.filter(
                (i) => i.propertyId === id
            );
            const relatedRentPayments = rentPaymentsRes.data.filter(
                (payment) => payment.propertyId === id
            );

            await Promise.all([
                axios.delete(`http://localhost:3001/properties/${id}`),
                ...relatedFavorites.map((f) =>
                    axios.delete(`http://localhost:3001/favorites/${f.id}`)
                ),
                ...relatedInquiries.map((i) =>
                    axios.delete(`http://localhost:3001/inquiries/${i.id}`)
                ),
                ...relatedRentPayments.map((payment) =>
                    axios.delete(`http://localhost:3001/rentPayments/${payment.id}`)
                )
            ]);

            loadProperties();
            emitPropertiesChanged();
        } catch (error) {
            console.log(error);
        }
    };

    const totalRent = properties.reduce((sum, p) => sum + Number(p.rent || 0), 0);

    const getBadgeClass = (type) => {
        if (!type) return "badge-default";
        const t = type.toLowerCase();
        if (t === "villa") return "badge-villa";
        if (t === "apartment") return "badge-apartment";
        if (t === "row house") return "badge-rowhouse";
        return "badge-default";
    };

    const getTypeEmoji = (type) => {
        if (!type) return "🏠";
        const t = type.toLowerCase();
        if (t === "villa") return "🏡";
        if (t === "apartment") return "🏢";
        if (t === "row house") return "🏘️";
        return "🏠";
    };

    const openInquiryModal = (inquiry, propertyName) => {
        setSelectedInquiry({ ...inquiry, propertyName });
    };

    const closeInquiryModal = () => {
        setSelectedInquiry(null);
    };

    const handleRequestMeeting = async () => {
        if (!selectedInquiry?.id) return;

        const confirmed = window.confirm(
            `Send meeting request to ${selectedInquiry.tenantName}?`
        );
        if (!confirmed) return;

        try {
            const updatedInquiry = {
                ...selectedInquiry,
                status: "Meeting Requested",
                meetingRequestedAt: new Date().toISOString()
            };

            await axios.put(
                `http://localhost:3001/inquiries/${selectedInquiry.id}`,
                updatedInquiry
            );

            setInquiries((prev) =>
                prev.map((item) =>
                    item.id === updatedInquiry.id ? updatedInquiry : item
                )
            );
            setSelectedInquiry(updatedInquiry);
            emitInquiriesChanged();
            alert("Meeting request sent to tenant!");
        } catch (error) {
            console.log(error);
            alert("Could not send meeting request. Please try again.");
        }
    };

    const handleEditFromModal = (property) => {
        closePropertyModal();
        handleEdit(property);
    };

    const handleDeleteFromModal = async (propertyId) => {
        closePropertyModal();
        await handleDelete(propertyId);
    };

    const renderPropertyModal = () => {
        if (!modalProperty) return null;

        const property = modalProperty;
        const propertyInquiries = getPropertyInquiries(property.id);
        const propertyRentPayments = getPropertyRentPayments(property.id);
        const activeDeal = getActiveDealForProperty(property.id, deals);
        const photos = property.photos || [];
        const hasPhotos = photos.length > 0;
        const activePhoto = hasPhotos ? photos[modalPhotoIndex] : null;

        return createPortal(
            <div className="landlord-property-modal-overlay" onClick={closePropertyModal}>
                <div
                    className="landlord-property-modal"
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="landlord-property-modal-close"
                        onClick={closePropertyModal}
                        aria-label="Close"
                    >
                        ✕
                    </button>

                    <div className="landlord-property-modal-layout">
                        <div className="landlord-property-modal-gallery">
                            {hasPhotos ? (
                                <>
                                    <div className="landlord-modal-main-photo">
                                        <img
                                            src={activePhoto}
                                            alt={`${property.propertyName} — photo ${modalPhotoIndex + 1}`}
                                        />
                                        {photos.length > 1 && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="landlord-modal-nav prev"
                                                    onClick={() =>
                                                        setModalPhotoIndex((index) =>
                                                            index === 0
                                                                ? photos.length - 1
                                                                : index - 1
                                                        )
                                                    }
                                                    aria-label="Previous photo"
                                                >
                                                    ‹
                                                </button>
                                                <button
                                                    type="button"
                                                    className="landlord-modal-nav next"
                                                    onClick={() =>
                                                        setModalPhotoIndex((index) =>
                                                            index === photos.length - 1
                                                                ? 0
                                                                : index + 1
                                                        )
                                                    }
                                                    aria-label="Next photo"
                                                >
                                                    ›
                                                </button>
                                                <span className="landlord-modal-photo-counter">
                                                    {modalPhotoIndex + 1} / {photos.length}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="landlord-modal-thumbs">
                                        {photos.map((photo, index) => (
                                            <button
                                                key={`${property.id}-photo-${index}`}
                                                type="button"
                                                className={`landlord-modal-thumb${index === modalPhotoIndex ? " active" : ""}`}
                                                onClick={() => setModalPhotoIndex(index)}
                                            >
                                                <img src={photo} alt={`Thumbnail ${index + 1}`} />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="landlord-modal-no-photo">
                                    <span>{getTypeEmoji(property.propertyType)}</span>
                                    <p>No photos uploaded for this property</p>
                                </div>
                            )}
                        </div>

                        <div className="landlord-property-modal-details">
                            <div className={`landlord-modal-type ${getBadgeClass(property.propertyType)}`}>
                                {getTypeEmoji(property.propertyType)} {property.propertyType || "Property"}
                            </div>
                            <h2>{property.propertyName}</h2>
                            <p className="landlord-modal-address">📍 {property.address || "Address not available"}</p>

                            <div className="landlord-modal-rent">
                                ₹{Number(property.rent).toLocaleString()}
                                <span>/ month</span>
                            </div>

                            {activeDeal && (
                                <div className="card-occupied-alert">
                                    🏠 Occupied by <strong>{activeDeal.tenantName}</strong>
                                </div>
                            )}

                            <div className="landlord-modal-info-grid">
                                <div className="landlord-modal-info-item">
                                    <span>Property type</span>
                                    <strong>{property.propertyType || "—"}</strong>
                                </div>
                                <div className="landlord-modal-info-item">
                                    <span>Monthly rent</span>
                                    <strong>₹{Number(property.rent).toLocaleString()}</strong>
                                </div>
                                <div className="landlord-modal-info-item">
                                    <span>Total photos</span>
                                    <strong>{photos.length || "None"}</strong>
                                </div>
                                <div className="landlord-modal-info-item">
                                    <span>Inquiries</span>
                                    <strong>{propertyInquiries.length}</strong>
                                </div>
                            </div>

                            {propertyInquiries.length > 0 && (
                                <div className="landlord-modal-inquiries">
                                    <h4>📩 Inquiries</h4>
                                    {propertyInquiries.map((inquiry) => (
                                        <button
                                            key={inquiry.id}
                                            type="button"
                                            className="inquiry-name-btn"
                                            onClick={() => {
                                                closePropertyModal();
                                                openInquiryModal(inquiry, property.propertyName);
                                            }}
                                        >
                                            <span className="inquiry-avatar">
                                                {(inquiry.tenantName || "T").charAt(0).toUpperCase()}
                                            </span>
                                            <span>{inquiry.tenantName}</span>
                                            <span className="landlord-inquiry-status">
                                                {inquiry.status || "Pending"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {propertyRentPayments.length > 0 && (
                                <div className="landlord-modal-rent-payments">
                                    <h4>💰 Rent Received</h4>
                                    {propertyRentPayments.slice(0, 5).map((payment) => (
                                        <div key={payment.id} className="landlord-rent-payment-row">
                                            <div>
                                                <strong>{formatRentMonth(payment.paidForMonth)}</strong>
                                                <span>{payment.tenantName}</span>
                                            </div>
                                            <strong>₹{Number(payment.amount).toLocaleString()}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeDeal && (
                                <p className="landlord-delete-blocked-note">
                                    Property cannot be removed while {activeDeal.tenantName} is
                                    still renting it.
                                </p>
                            )}

                            <div className="landlord-modal-actions">
                                <button
                                    type="button"
                                    className="edit-btn"
                                    onClick={() => handleEditFromModal(property)}
                                >
                                    ✏️ Edit Property
                                </button>
                                <button
                                    type="button"
                                    className="delete-btn"
                                    onClick={() => handleDeleteFromModal(property.id)}
                                    disabled={Boolean(activeDeal)}
                                    title={
                                        activeDeal
                                            ? "Cannot remove while tenant is occupying this property"
                                            : "Remove property"
                                    }
                                >
                                    🗑 Remove Property
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

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
                            <span>Landlord workspace</span>
                        </div>
                    </div>

                    <div className="dash-header-actions">
                        <div className="dash-live-pill">
                            <span className="dash-live-dot" />
                            Live sync
                        </div>
                        <UserMenu
                            userName={userName}
                            userRole="Landlord"
                            userInitial={userInitial}
                            theme={theme}
                            onToggleTheme={toggleTheme}
                            onLogout={handleLogout}
                        >
                            <button type="button" onClick={() => setShowProfileModal(true)}>
                                👤 My Profile
                            </button>
                            <button type="button" onClick={() => setShowProfileModal(true)}>
                                ✏️ Edit Profile
                            </button>
                        </UserMenu>
                    </div>
                </div>
            </header>

            <ProfileModal
                user={user}
                open={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                onSave={handleProfileSave}
            />

            {selectedInquiry && (
                <div className="profile-modal-overlay" onClick={closeInquiryModal}>
                    <div className="profile-modal inquiry-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h2>Inquiry Details</h2>
                            <button
                                type="button"
                                className="profile-modal-close"
                                onClick={closeInquiryModal}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="profile-modal-body">
                            <div className="profile-modal-avatar">
                                {(selectedInquiry.tenantName || "T").charAt(0).toUpperCase()}
                            </div>

                            <p className="inquiry-modal-intro">
                                <strong>{selectedInquiry.tenantName}</strong> has sent an inquiry for{" "}
                                <strong>{selectedInquiry.propertyName}</strong>
                            </p>

                            <div className="profile-details">
                                <div className="profile-detail-row">
                                    <span className="profile-label">Name</span>
                                    <span className="profile-value">{selectedInquiry.tenantName}</span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Mobile</span>
                                    <span className="profile-value">
                                        {selectedInquiry.tenantPhone || "Not available"}
                                    </span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Email</span>
                                    <span className="profile-value">
                                        {selectedInquiry.tenantEmail || "Not available"}
                                    </span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Property</span>
                                    <span className="profile-value">{selectedInquiry.propertyName}</span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Inquiry Date</span>
                                    <span className="profile-value">
                                        {new Date(selectedInquiry.createdAt).toLocaleDateString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Status</span>
                                    <span className={`inquiry-status-badge status-${(selectedInquiry.status || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                                        {selectedInquiry.status || "Pending"}
                                    </span>
                                </div>
                            </div>

                            <div className="inquiry-modal-actions">
                                {selectedInquiry.status === "Meeting Requested" ? (
                                    <p className="inquiry-sent-note">
                                        ✓ Meeting request already sent to this tenant
                                    </p>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn-meeting-request"
                                        onClick={handleRequestMeeting}
                                    >
                                        🤝 Interested in Meeting
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="dash-page">
                <div className="dash-page-intro dash-page-intro-row">
                    <div>
                        <p className="dash-page-eyebrow">Landlord</p>
                        <h1>My Properties</h1>
                        <p className="dash-page-subtitle">Manage your rental portfolio in one place</p>
                    </div>
                    <button
                        type="button"
                        className={`dash-primary-btn${showForm ? " secondary" : ""}`}
                        onClick={() => (showForm ? resetForm() : openAddForm())}
                    >
                        {showForm ? "✕ Cancel" : "+ Add Property"}
                    </button>
                </div>

                <div className="dash-page-body">
                <div className="dash-stats-row">
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon blue">🏠</div>
                        <div>
                            <span className="dash-stat-value">{properties.length}</span>
                            <span className="dash-stat-label">Total Properties</span>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon green">💰</div>
                        <div>
                            <span className="dash-stat-value">₹{totalRent.toLocaleString()}</span>
                            <span className="dash-stat-label">Monthly Rental Income</span>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon purple">💳</div>
                        <div>
                            <span className="dash-stat-value">₹{rentReceivedThisMonth.toLocaleString()}</span>
                            <span className="dash-stat-label">Rent Received ({formatRentMonth(currentRentMonth)})</span>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon orange">📈</div>
                        <div>
                            <span className="dash-stat-value">₹{totalRentReceived.toLocaleString()}</span>
                            <span className="dash-stat-label">Total Rent Collected</span>
                        </div>
                    </div>
                </div>

                {/* Add Property Form */}
                {showForm && (
                    <div className="dash-panel property-form-wrapper">
                        <div className="form-title">
                            {editingId ? "Edit Property" : "Register New Property"}
                        </div>
                        <form className="property-form" onSubmit={handleSubmit}>

                            <div className="form-group">
                                <label>Property Name</label>
                                <input
                                    type="text"
                                    name="propertyName"
                                    placeholder="e.g. Sunshine Villa"
                                    value={propertyData.propertyName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group form-group-full">
                                <label>Property Photos</label>
                                <div className="photo-upload-area">
                                    <label className="photo-upload-btn">
                                        {photoUploading ? "Uploading..." : "+ Add Photos"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handlePhotoChange}
                                            disabled={
                                                photoUploading ||
                                                propertyData.photos.length >= MAX_PHOTOS
                                            }
                                            hidden
                                        />
                                    </label>
                                    <span className="photo-upload-hint">
                                        Up to {MAX_PHOTOS} images (max 3 MB each)
                                    </span>
                                </div>

                                {propertyData.photos.length > 0 && (
                                    <div className="photo-preview-grid">
                                        {propertyData.photos.map((photo, index) => (
                                            <div key={`${index}-${photo.slice(0, 24)}`} className="photo-preview-item">
                                                <img src={photo} alt={`Property ${index + 1}`} />
                                                <button
                                                    type="button"
                                                    className="photo-remove-btn"
                                                    onClick={() => removePhoto(index)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Address</label>
                                <input
                                    type="text"
                                    name="address"
                                    placeholder="e.g. Adajan, Surat"
                                    value={propertyData.address}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Property Type</label>
                                <select
                                    name="propertyType"
                                    value={propertyData.propertyType}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select type</option>
                                    <option value="Villa">Villa</option>
                                    <option value="Apartment">Apartment</option>
                                    <option value="Row House">Row House</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Monthly Rent (₹)</label>
                                <input
                                    type="number"
                                    name="rent"
                                    placeholder="e.g. 15000"
                                    value={propertyData.rent}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-submit-row">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={resetForm}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    {editingId ? "✓ Save Changes" : "✓ Register Property"}
                                </button>
                            </div>

                        </form>
                    </div>
                )}

                {/* Properties Section */}
                <div className="section-header">
                    <span className="section-title">All Properties</span>
                    {properties.length > 0 && (
                        <span className="property-count-badge">
                            {properties.length} {properties.length === 1 ? "property" : "properties"}
                        </span>
                    )}
                </div>

                {properties.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏗️</div>
                        <h3>No properties yet</h3>
                        <p>Add your first property to start managing your rental portfolio.</p>
                        <button
                            className="empty-state-btn"
                            onClick={openAddForm}
                        >
                            + Add Your First Property
                        </button>
                    </div>
                ) : (
                    <div className="property-grid">
                        {properties.map((property) => {
                            const propertyInquiries = getPropertyInquiries(property.id);
                            const activeDeal = getActiveDealForProperty(property.id, deals);

                            return (
                            <div
                                key={property.id}
                                className={`property-card-simple${editingId === property.id ? " editing" : ""}${activeDeal ? " occupied" : ""}`}
                                onClick={() => openPropertyModal(property)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        openPropertyModal(property);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="property-card-simple-top">
                                    <span className={`card-type-badge ${getBadgeClass(property.propertyType)}`}>
                                        {getTypeEmoji(property.propertyType)} {property.propertyType || "Property"}
                                    </span>
                                    {activeDeal && (
                                        <span className="card-occupied-pill">
                                            Occupied · {activeDeal.tenantName}
                                        </span>
                                    )}
                                </div>

                                <h3 className="property-card-simple-name">{property.propertyName}</h3>
                                <p className="property-card-simple-address">{property.address}</p>

                                <div className="property-card-simple-rent">
                                    ₹{Number(property.rent).toLocaleString()}
                                    <span>/mo</span>
                                </div>

                                {propertyInquiries.length > 0 && (
                                    <span className="property-card-inquiry-count">
                                        📩 {propertyInquiries.length} {propertyInquiries.length === 1 ? "inquiry" : "inquiries"}
                                    </span>
                                )}

                                <span className="property-card-view-hint">View photos & details →</span>
                            </div>
                            );
                        })}
                    </div>
                )}

                </div>
            </main>

            {renderPropertyModal()}
        </div>
    );
}

export default LandlordDashboard;
