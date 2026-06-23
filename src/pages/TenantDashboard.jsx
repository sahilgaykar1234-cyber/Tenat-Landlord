import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getLoggedInUser, clearAuth, setLoggedInUser } from "../utils/auth";
import {
    emitInquiriesChanged,
    onPropertiesChanged,
    onInquiriesChanged,
    onDealsChanged,
    onRentPaymentsChanged,
    emitDealsChanged,
    emitPropertiesChanged,
    emitRentPaymentsChanged,
    emitUsersChanged
} from "../utils/socket";
import { openRazorpayCheckout, openRazorpayRentCheckout } from "../utils/payments";
import {
    filterBrowsableProperties,
    isDealActive,
    isPropertyOccupied
} from "../utils/occupancy";
import {
    formatRentMonth,
    getCurrentRentMonth,
    getRentPaymentsForDeal,
    hasRentPaidForMonth
} from "../utils/rent";
import UserMenu from "../components/UserMenu";
import ProfileModal from "../components/ProfileModal";
import { useTheme } from "../hooks/useTheme";
import "./TenantDashboard.css";
import "../styles/dashboard-shell.css";

const TENANT_NAV = [
    { id: "browse", label: "Browse", icon: "◫" },
    { id: "favorites", label: "Favourites", icon: "♥" },
    { id: "inquiries", label: "Inquiries", icon: "✉" }
];

function TenantDashboard() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [user, setUser] = useState(() => getLoggedInUser() || {});
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [properties, setProperties] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [deals, setDeals] = useState([]);
    const [allDeals, setAllDeals] = useState([]);
    const [activeTab, setActiveTab] = useState("browse");
    const [payingDealId, setPayingDealId] = useState(null);
    const [payingRentKey, setPayingRentKey] = useState(null);
    const [rentPayments, setRentPayments] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
    const [locationFilter, setLocationFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const userName = user?.name || "User";
    const userInitial = userName.charAt(0).toUpperCase();

    useEffect(() => {
        loadData();
        const unsubProperties = onPropertiesChanged(() => {
            loadData();
        });
        const unsubInquiries = onInquiriesChanged(() => {
            loadData();
        });
        const unsubDeals = onDealsChanged(() => {
            loadData();
        });
        const unsubRentPayments = onRentPaymentsChanged(() => {
            loadData();
        });
        return () => {
            unsubProperties();
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

    const loadData = async () => {
        try {
            const [propertiesRes, favoritesRes, inquiriesRes, usersRes, dealsRes, rentPaymentsRes] = await Promise.all([
                axios.get("http://localhost:3001/properties"),
                axios.get("http://localhost:3001/favorites"),
                axios.get("http://localhost:3001/inquiries"),
                axios.get("http://localhost:3001/users"),
                axios.get("http://localhost:3001/deals"),
                axios.get("http://localhost:3001/rentPayments")
            ]);

            const validProperties = propertiesRes.data.filter((p) => p.propertyName);
            const propertyIds = new Set(validProperties.map((p) => p.id));
            const myFavorites = favoritesRes.data.filter((f) => f.tenantId === user.id);

            const orphanFavorites = myFavorites.filter(
                (f) => !propertyIds.has(f.propertyId)
            );
            if (orphanFavorites.length > 0) {
                await Promise.all(
                    orphanFavorites.map((f) =>
                        axios.delete(`http://localhost:3001/favorites/${f.id}`)
                    )
                );
            }

            const activeFavorites = myFavorites.filter((f) =>
                propertyIds.has(f.propertyId)
            );

            const dealsList = dealsRes.data;
            const browsableProperties = filterBrowsableProperties(
                validProperties,
                user.id,
                dealsList
            );

            setProperties(browsableProperties);
            setFavorites(activeFavorites);

            const myInquiries = inquiriesRes.data
                .filter((inquiry) => inquiry.tenantId === user.id)
                .map((inquiry) => {
                    const landlord = usersRes.data.find((u) => u.id === inquiry.landlordId);
                    return {
                        ...inquiry,
                        landlordName: landlord?.name || "Landlord",
                        landlordPhone: landlord?.phone || "",
                        landlordEmail: landlord?.email || ""
                    };
                })
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setInquiries(myInquiries);

            const myDeals = dealsList
                .filter((deal) => deal.tenantId === user.id)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setDeals(myDeals);
            setAllDeals(dealsList);

            const myRentPayments = rentPaymentsRes.data
                .filter((payment) => payment.tenantId === user.id)
                .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

            setRentPayments(myRentPayments);
        } catch (error) {
            console.log(error);
        }
    };

    const isFavorite = (propertyId) =>
        favorites.some((f) => f.propertyId === propertyId);

    const favoriteProperties = favorites
        .map((fav) => properties.find((p) => p.id === fav.propertyId))
        .filter(Boolean);

    const meetingUpdates = inquiries.filter(
        (inquiry) => inquiry.status === "Meeting Requested"
    );

    const pendingPayments = deals.filter(
        (deal) => deal.paymentStatus === "Pending"
    );

    const getDealForInquiry = (inquiryId) =>
        deals.find((deal) => deal.inquiryId === inquiryId);

    const modalProperty = selectedProperty
        ? properties.find((property) => property.id === selectedProperty.id) || selectedProperty
        : null;

    const availableLocations = [
        ...new Set(properties.map((property) => property.address).filter(Boolean))
    ].sort();

    const baseProperties =
        activeTab === "browse" ? properties : favoriteProperties;

    const matchesSearch = (property, query) => {
        const term = query.trim().toLowerCase();
        if (!term) return true;

        const searchable = [
            property.propertyName,
            property.address,
            property.propertyType,
            property.rent
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(term);
    };

    let filteredProperties = baseProperties;

    if (activeTab === "browse" && locationFilter !== "all") {
        filteredProperties = filteredProperties.filter(
            (property) => property.address === locationFilter
        );
    }

    if (searchQuery.trim()) {
        filteredProperties = filteredProperties.filter((property) =>
            matchesSearch(property, searchQuery)
        );
    }

    const displayProperties = filteredProperties;

    const isLocationFiltered =
        activeTab === "browse" && locationFilter !== "all";

    const isSearchActive = searchQuery.trim().length > 0;

    const isBrowseFiltered =
        activeTab === "browse" && (isLocationFiltered || isSearchActive);

    const clearBrowseFilters = () => {
        setLocationFilter("all");
        setSearchQuery("");
    };

    const getInquiryForProperty = (propertyId) => {
        const propertyInquiries = inquiries.filter(
            (inquiry) => inquiry.propertyId === propertyId
        );
        return (
            propertyInquiries.find(
                (inquiry) => inquiry.status === "Meeting Requested"
            ) || propertyInquiries[0]
        );
    };

    const canSendInquiry = (propertyId) => {
        if (isPropertyOccupied(propertyId, allDeals)) {
            return false;
        }

        const existing = inquiries.find(
            (inquiry) => inquiry.propertyId === propertyId
        );

        if (!existing) return true;

        return ["Property Rented", "Tenant Left"].includes(existing.status);
    };

    const handleLeaveProperty = async (deal) => {
        if (!isDealActive(deal)) return;

        const confirmed = window.confirm(
            `Leave "${deal.propertyName}"?\n\nThe property will become available for other tenants to browse and inquire.`
        );
        if (!confirmed) return;

        try {
            await axios.patch(`http://localhost:3001/deals/${deal.id}`, {
                occupancyStatus: "Left",
                leftAt: new Date().toISOString()
            });

            if (deal.inquiryId) {
                await axios.patch(`http://localhost:3001/inquiries/${deal.inquiryId}`, {
                    status: "Tenant Left"
                });
            }

            alert("You have left the property. It is now listed again for others.");
            emitDealsChanged();
            emitPropertiesChanged();
            emitInquiriesChanged();
            loadData();
        } catch (error) {
            console.log(error);
            alert("Could not update property status. Please try again.");
        }
    };

    const handleFavorite = async (property) => {
        const existing = favorites.find(
            (f) => f.propertyId === property.id
        );

        try {
            if (existing) {
                await axios.delete(`http://localhost:3001/favorites/${existing.id}`);
            } else {
                await axios.post("http://localhost:3001/favorites", {
                    tenantId: user.id,
                    propertyId: property.id,
                    propertyName: property.propertyName
                });
            }
            loadData();
        } catch (error) {
            console.log(error);
            alert("Could not update favourite. Please try again.");
        }
    };

    const handleInquiry = async (property) => {
        const existing = inquiries.find(
            (inquiry) => inquiry.propertyId === property.id
        );

        if (existing) {
            if (["Property Rented", "Tenant Left"].includes(existing.status)) {
                // Allow sending a fresh inquiry after property is available again.
            } else if (existing.status === "Pending") {
                alert(
                    "You already sent an inquiry for this property. Please wait for the landlord to respond."
                );
                return;
            } else {
                alert(
                    "You already have an inquiry for this property. Check the My Inquiries tab for updates."
                );
                return;
            }
        }

        const confirmed = window.confirm(
            `Send inquiry for "${property.propertyName}"?`
        );
        if (!confirmed) return;

        try {
            if (existing && ["Property Rented", "Tenant Left"].includes(existing.status)) {
                await axios.patch(`http://localhost:3001/inquiries/${existing.id}`, {
                    tenantId: user.id,
                    tenantName: user.name,
                    tenantEmail: user.email,
                    tenantPhone: user.phone,
                    propertyId: property.id,
                    propertyName: property.propertyName,
                    landlordId: property.landlordId,
                    status: "Pending",
                    createdAt: new Date().toISOString(),
                    meetingRequestedAt: null
                });
            } else {
                await axios.post("http://localhost:3001/inquiries", {
                    tenantId: user.id,
                    tenantName: user.name,
                    tenantEmail: user.email,
                    tenantPhone: user.phone,
                    propertyId: property.id,
                    propertyName: property.propertyName,
                    landlordId: property.landlordId,
                    status: "Pending",
                    createdAt: new Date().toISOString()
                });
            }
            alert("Inquiry sent successfully!");
            emitInquiriesChanged();
            loadData();
        } catch (error) {
            console.log(error);
            alert("Could not send inquiry. Please try again.");
        }
    };

    const handleLogout = () => {
        clearAuth();
        navigate("/", { replace: true });
    };

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

    const handlePayPlatformFee = async (deal) => {
        const confirmed = window.confirm(
            `Pay platform fee for "${deal.propertyName}"?\n\nMonthly rent: ₹${Number(deal.monthlyRent).toLocaleString()}\nYou pay 50%: ₹${Number(deal.commissionAmount).toLocaleString()}`
        );
        if (!confirmed) return;

        setPayingDealId(deal.id);

        try {
            await openRazorpayCheckout({ dealId: deal.id, deal, user });
            alert("Payment successful! Thank you.");
            loadData();
        } catch (error) {
            console.log(error);
            alert(error.message || "Payment could not be completed.");
        } finally {
            setPayingDealId(null);
        }
    };

    const handlePayMonthlyRent = async (deal) => {
        const rentMonth = getCurrentRentMonth();
        const monthLabel = formatRentMonth(rentMonth);

        if (hasRentPaidForMonth(rentPayments, deal.id, rentMonth)) {
            alert(`Rent for ${monthLabel} is already paid.`);
            return;
        }

        const confirmed = window.confirm(
            `Pay monthly rent for "${deal.propertyName}"?\n\nLandlord: ${deal.landlordName}\nMonth: ${monthLabel}\nAmount: ₹${Number(deal.monthlyRent).toLocaleString()}`
        );
        if (!confirmed) return;

        const paymentKey = `${deal.id}-${rentMonth}`;
        setPayingRentKey(paymentKey);

        try {
            await openRazorpayRentCheckout({
                dealId: deal.id,
                deal,
                user,
                paidForMonth: rentMonth
            });
            alert("Monthly rent paid successfully!");
            emitRentPaymentsChanged();
            loadData();
        } catch (error) {
            console.log(error);
            alert(error.message || "Rent payment could not be completed.");
        } finally {
            setPayingRentKey(null);
        }
    };

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

    const renderPropertyCard = (property) => {
        const favourited = isFavorite(property.id);
        const inquiry = getInquiryForProperty(property.id);

        return (
            <div
                key={property.id}
                className="tenant-property-card"
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
                <div className="tenant-card-top">
                    <span className={`tenant-card-type ${getBadgeClass(property.propertyType)}`}>
                        {getTypeEmoji(property.propertyType)} {property.propertyType || "Property"}
                    </span>
                    {favourited && (
                        <span className="tenant-card-fav-badge">❤️ Saved</span>
                    )}
                </div>

                <h3 className="tenant-card-name">{property.propertyName}</h3>
                <p className="tenant-card-address">{property.address}</p>
                <div className="tenant-card-rent">
                    ₹{Number(property.rent).toLocaleString()}
                    <span>/mo</span>
                </div>
                {inquiry?.status === "Meeting Requested" && (
                    <span className="tenant-card-status meeting">Meeting requested</span>
                )}
                {inquiry?.status === "Deal Closed" && (
                    <span className="tenant-card-status deal">Deal closed</span>
                )}
                {inquiry?.status === "Pending" && (
                    <span className="tenant-card-status pending">Inquiry sent</span>
                )}
                <span className="tenant-card-view-hint">View photos & details →</span>
            </div>
        );
    };

    const renderPropertyModal = () => {
        if (!modalProperty) return null;

        const property = modalProperty;
        const favourited = isFavorite(property.id);
        const inquiry = getInquiryForProperty(property.id);
        const inquiryAllowed = canSendInquiry(property.id);
        const photos = property.photos || [];
        const hasPhotos = photos.length > 0;
        const activePhoto = hasPhotos ? photos[modalPhotoIndex] : null;

        return createPortal(
            <div className="tenant-property-modal-overlay" onClick={closePropertyModal}>
                <div
                    className="tenant-property-modal"
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="tenant-property-modal-close"
                        onClick={closePropertyModal}
                        aria-label="Close"
                    >
                        ✕
                    </button>

                    <div className="tenant-property-modal-layout">
                        <div className="tenant-property-modal-gallery">
                            {hasPhotos ? (
                                <>
                                    <div className="tenant-modal-main-photo">
                                        <img
                                            src={activePhoto}
                                            alt={`${property.propertyName} — photo ${modalPhotoIndex + 1}`}
                                        />
                                        {photos.length > 1 && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="tenant-modal-nav prev"
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
                                                    className="tenant-modal-nav next"
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
                                                <span className="tenant-modal-photo-counter">
                                                    {modalPhotoIndex + 1} / {photos.length}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="tenant-modal-thumbs">
                                        {photos.map((photo, index) => (
                                            <button
                                                key={`${property.id}-photo-${index}`}
                                                type="button"
                                                className={`tenant-modal-thumb${index === modalPhotoIndex ? " active" : ""}`}
                                                onClick={() => setModalPhotoIndex(index)}
                                            >
                                                <img
                                                    src={photo}
                                                    alt={`Thumbnail ${index + 1}`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="tenant-modal-no-photo">
                                    <span>{getTypeEmoji(property.propertyType)}</span>
                                    <p>No photos uploaded for this property</p>
                                </div>
                            )}
                        </div>

                        <div className="tenant-property-modal-details">
                            <div className={`tenant-modal-type ${getBadgeClass(property.propertyType)}`}>
                                {getTypeEmoji(property.propertyType)} {property.propertyType || "Property"}
                            </div>
                            <h2>{property.propertyName}</h2>
                            <p className="tenant-modal-address">📍 {property.address || "Address not available"}</p>

                            <div className="tenant-modal-rent">
                                ₹{Number(property.rent).toLocaleString()}
                                <span>/ month</span>
                            </div>

                            <div className="tenant-modal-info-grid">
                                <div className="tenant-modal-info-item">
                                    <span>Property type</span>
                                    <strong>{property.propertyType || "—"}</strong>
                                </div>
                                <div className="tenant-modal-info-item">
                                    <span>Monthly rent</span>
                                    <strong>₹{Number(property.rent).toLocaleString()}</strong>
                                </div>
                                <div className="tenant-modal-info-item">
                                    <span>Total photos</span>
                                    <strong>{photos.length || "None"}</strong>
                                </div>
                            </div>

                            {inquiry?.status === "Deal Closed" && (
                                <div className="tenant-deal-closed-alert">
                                    ✅ Deal closed — check My Inquiries for payment
                                </div>
                            )}
                            {inquiry?.status === "Meeting Requested" && (
                                <div className="tenant-meeting-alert">
                                    🤝 Landlord is interested in meeting with you!
                                </div>
                            )}
                            {inquiry?.status === "Pending" && (
                                <div className="tenant-inquiry-pending">
                                    📩 Inquiry sent — waiting for landlord
                                </div>
                            )}

                            <div className="tenant-modal-actions">
                                <button
                                    type="button"
                                    className={`tenant-fav-btn${favourited ? " active" : ""}`}
                                    onClick={() => handleFavorite(property)}
                                >
                                    {favourited ? "❤️ Favourited" : "🤍 Favourite"}
                                </button>
                                <button
                                    type="button"
                                    className={`tenant-inquiry-btn${!inquiryAllowed ? " disabled" : ""}`}
                                    onClick={() => handleInquiry(property)}
                                    disabled={!inquiryAllowed}
                                >
                                    {!inquiryAllowed ? "📩 Inquiry Sent" : "📩 Send Inquiry"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    const renderInquiryCard = (inquiry) => {
        const isMeetingRequested = inquiry.status === "Meeting Requested";
        const isDealClosed = inquiry.status === "Deal Closed";
        const isTenantLeft = inquiry.status === "Tenant Left";
        const deal = getDealForInquiry(inquiry.id);
        const paymentPending = deal?.paymentStatus === "Pending";
        const paymentPaid = deal?.paymentStatus === "Paid";
        const isActiveTenancy = deal && isDealActive(deal);
        const currentRentMonth = getCurrentRentMonth();
        const rentPaidThisMonth =
            deal && hasRentPaidForMonth(rentPayments, deal.id, currentRentMonth);
        const dealRentHistory = deal ? getRentPaymentsForDeal(rentPayments, deal.id) : [];
        const rentPaymentKey = deal ? `${deal.id}-${currentRentMonth}` : "";

        return (
            <div
                key={inquiry.id}
                className={`tenant-inquiry-card${isMeetingRequested ? " meeting-requested" : ""}${isDealClosed ? " deal-closed" : ""}${isTenantLeft ? " tenant-left" : ""}`}
            >
                <div className="tenant-inquiry-card-header">
                    <h3>{inquiry.propertyName}</h3>
                    <span className={`tenant-inquiry-status status-${(inquiry.status || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                        {inquiry.status || "Pending"}
                    </span>
                </div>

                {isTenantLeft ? (
                    <div className="tenant-left-banner">
                        <strong>🏠 You left this property</strong>
                        <p>
                            This property is listed again for other tenants. You can send a
                            new inquiry if you want to rent it again.
                        </p>
                    </div>
                ) : isDealClosed && deal ? (
                    <>
                    <div className={`tenant-deal-banner${paymentPending ? " payment-due" : " payment-done"}`}>
                        <strong>
                            {paymentPending
                                ? "💳 Platform fee payment required"
                                : "✅ Platform fee paid"}
                        </strong>
                        <p>
                            Deal closed for <strong>{inquiry.propertyName}</strong>.
                            {paymentPending
                                ? " Pay 50% of monthly rent to complete the booking."
                                : " Your payment has been received."}
                        </p>
                        <div className="tenant-payment-breakdown">
                            <span>Monthly rent</span>
                            <strong>₹{Number(deal.monthlyRent).toLocaleString()}</strong>
                            <span>You pay (50%)</span>
                            <strong>₹{Number(deal.commissionAmount).toLocaleString()}</strong>
                        </div>
                        {paymentPending && (
                            <button
                                type="button"
                                className="tenant-pay-btn"
                                onClick={() => handlePayPlatformFee(deal)}
                                disabled={payingDealId === deal.id}
                            >
                                {payingDealId === deal.id
                                    ? "Processing..."
                                    : `Pay ₹${Number(deal.commissionAmount).toLocaleString()}`}
                            </button>
                        )}
                        {paymentPaid && deal.paidAt && (
                            <p className="tenant-payment-paid-note">
                                Paid on{" "}
                                {new Date(deal.paidAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                })}
                            </p>
                        )}
                        {isActiveTenancy && (
                            <button
                                type="button"
                                className="tenant-leave-btn"
                                onClick={() => handleLeaveProperty(deal)}
                            >
                                Leave Property
                            </button>
                        )}
                    </div>

                    {isActiveTenancy && (
                    <div className={`tenant-rent-banner${rentPaidThisMonth ? " rent-paid" : " rent-due"}`}>
                        <strong>
                            {rentPaidThisMonth
                                ? "✅ Monthly rent paid"
                                : "🏠 Pay monthly rent to landlord"}
                        </strong>
                        <p>
                            Pay rent to <strong>{deal.landlordName}</strong> for{" "}
                            <strong>{formatRentMonth(currentRentMonth)}</strong>.
                        </p>
                        <div className="tenant-payment-breakdown">
                            <span>Landlord</span>
                            <strong>{deal.landlordName}</strong>
                            <span>Rent amount</span>
                            <strong>₹{Number(deal.monthlyRent).toLocaleString()}</strong>
                        </div>
                        {!rentPaidThisMonth && (
                            <button
                                type="button"
                                className="tenant-rent-pay-btn"
                                onClick={() => handlePayMonthlyRent(deal)}
                                disabled={payingRentKey === rentPaymentKey}
                            >
                                {payingRentKey === rentPaymentKey
                                    ? "Processing..."
                                    : `Pay Rent ₹${Number(deal.monthlyRent).toLocaleString()}`}
                            </button>
                        )}
                        {dealRentHistory.length > 0 && (
                            <div className="tenant-rent-history">
                                <span>Recent rent payments</span>
                                {dealRentHistory.slice(0, 3).map((payment) => (
                                    <div key={payment.id} className="tenant-rent-history-row">
                                        <strong>{formatRentMonth(payment.paidForMonth)}</strong>
                                        <span>₹{Number(payment.amount).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}
                    </>
                ) : isMeetingRequested ? (
                    <div className="tenant-meeting-banner">
                        <strong>🤝 Landlord wants to meet!</strong>
                        <p>
                            {inquiry.landlordName} is interested in meeting with you
                            regarding <strong>{inquiry.propertyName}</strong>.
                        </p>
                    </div>
                ) : (
                    <p className="tenant-inquiry-waiting">
                        Your inquiry is sent. Waiting for landlord to respond.
                    </p>
                )}

                <div className="tenant-inquiry-meta">
                    <div className="tenant-inquiry-meta-row">
                        <span>Landlord</span>
                        <strong>{inquiry.landlordName}</strong>
                    </div>
                    {inquiry.landlordPhone && (
                        <div className="tenant-inquiry-meta-row">
                            <span>Mobile</span>
                            <strong>{inquiry.landlordPhone}</strong>
                        </div>
                    )}
                    {inquiry.landlordEmail && (
                        <div className="tenant-inquiry-meta-row">
                            <span>Email</span>
                            <strong>{inquiry.landlordEmail}</strong>
                        </div>
                    )}
                    <div className="tenant-inquiry-meta-row">
                        <span>Sent on</span>
                        <strong>
                            {new Date(inquiry.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                            })}
                        </strong>
                    </div>
                    {inquiry.meetingRequestedAt && (
                        <div className="tenant-inquiry-meta-row">
                            <span>Meeting update</span>
                            <strong>
                                {new Date(inquiry.meetingRequestedAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                })}
                            </strong>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const tenantPageTitle =
        activeTab === "browse"
            ? "Browse Properties"
            : activeTab === "favorites"
                ? "My Favourites"
                : "My Inquiries";

    const tenantPageSubtitle =
        activeTab === "browse"
            ? isBrowseFiltered
                ? isSearchActive && isLocationFiltered
                    ? `Results in ${locationFilter} for "${searchQuery.trim()}"`
                    : isSearchActive
                        ? `Search results for "${searchQuery.trim()}"`
                        : `Showing properties in ${locationFilter}`
                : "Find your next home from available rentals"
            : activeTab === "favorites"
                ? "Properties you have saved"
                : "Track your inquiries and landlord responses";

    const tenantAlertCount = meetingUpdates.length + pendingPayments.length;

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
                            <span>Tenant workspace</span>
                        </div>
                    </div>

                    <div className="dash-header-actions">
                        <div className="dash-live-pill">
                            <span className="dash-live-dot" />
                            Live sync
                        </div>
                        <UserMenu
                            userName={userName}
                            userRole="Tenant"
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

                <nav className="dash-nav-rail" aria-label="Tenant sections">
                    {TENANT_NAV.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`dash-nav-pill${activeTab === item.id ? " active" : ""}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <span className="dash-nav-pill-icon">{item.icon}</span>
                            <span className="dash-nav-pill-label">{item.label}</span>
                            {item.id === "favorites" && favorites.length > 0 && (
                                <span className="dash-nav-pill-badge">{favorites.length}</span>
                            )}
                            {item.id === "inquiries" && tenantAlertCount > 0 && (
                                <span className="dash-nav-pill-badge">{tenantAlertCount}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="dash-page">
                <div className="dash-page-intro dash-page-intro-row">
                    <div>
                        <p className="dash-page-eyebrow">Tenant</p>
                        <h1>{tenantPageTitle}</h1>
                        <p className="dash-page-subtitle">{tenantPageSubtitle}</p>
                    </div>
                    <span className="dash-count-badge">
                        {activeTab === "inquiries"
                            ? `${inquiries.length} ${inquiries.length === 1 ? "inquiry" : "inquiries"}`
                            : `${displayProperties.length} ${displayProperties.length === 1 ? "property" : "properties"}`}
                    </span>
                </div>

                <div className="dash-page-body">
                {meetingUpdates.length > 0 && activeTab !== "inquiries" && (
                    <div className="dash-alert-banner info">
                        🤝 {meetingUpdates.length} landlord{meetingUpdates.length > 1 ? "s are" : " is"} interested in meeting with you!
                        <button type="button" onClick={() => setActiveTab("inquiries")}>
                            View updates
                        </button>
                    </div>
                )}

                {pendingPayments.length > 0 && activeTab !== "inquiries" && (
                    <div className="dash-alert-banner warning">
                        💳 {pendingPayments.length} deal{pendingPayments.length > 1 ? "s need" : " needs"} platform fee payment
                        <button type="button" onClick={() => setActiveTab("inquiries")}>
                            Pay now
                        </button>
                    </div>
                )}

                {(activeTab === "browse" || activeTab === "favorites") && (
                    <div className="dash-panel tenant-search-filter">
                        <div className="tenant-search-bar">
                            <span className="tenant-search-icon">🔍</span>
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search by name, area, type, or rent..."
                                aria-label="Search properties"
                            />
                            {isSearchActive && (
                                <button
                                    type="button"
                                    className="tenant-search-clear"
                                    onClick={() => setSearchQuery("")}
                                    aria-label="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {activeTab === "browse" && availableLocations.length > 0 && (
                            <div className="tenant-location-filter-inner">
                                <div className="tenant-location-filter-head">
                                    <span className="tenant-location-filter-label">
                                        📍 Where do you want to live?
                                    </span>
                                    {isBrowseFiltered && (
                                        <button
                                            type="button"
                                            className="tenant-location-clear"
                                            onClick={clearBrowseFilters}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className="tenant-location-chips">
                                    <button
                                        type="button"
                                        className={`tenant-location-chip${locationFilter === "all" ? " active" : ""}`}
                                        onClick={() => setLocationFilter("all")}
                                    >
                                        All areas
                                    </button>
                                    {availableLocations.map((location) => (
                                        <button
                                            key={location}
                                            type="button"
                                            className={`tenant-location-chip${locationFilter === location ? " active" : ""}`}
                                            onClick={() => setLocationFilter(location)}
                                        >
                                            {location}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "inquiries" ? (
                    inquiries.length === 0 ? (
                        <div className="tenant-empty">
                            <div className="tenant-empty-icon">📭</div>
                            <h3>No inquiries yet</h3>
                            <p>Browse properties and send an inquiry to contact landlords.</p>
                        </div>
                    ) : (
                        <div className="tenant-inquiry-list">
                            {inquiries.map(renderInquiryCard)}
                        </div>
                    )
                ) : displayProperties.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">
                            {activeTab === "browse" ? "🏗️" : "🤍"}
                        </div>
                        <h3>
                            {activeTab === "browse"
                                ? isBrowseFiltered
                                    ? "No matching properties"
                                    : "No properties available"
                                : isSearchActive
                                    ? "No matching favourites"
                                    : "No favourites yet"}
                        </h3>
                        <p>
                            {activeTab === "browse"
                                ? isBrowseFiltered
                                    ? "Try a different search or area."
                                    : "Check back later for new listings."
                                : isSearchActive
                                    ? "Try a different search term."
                                    : "Browse properties and tap Favourite to save them here."}
                        </p>
                        {isBrowseFiltered && (
                            <button
                                type="button"
                                className="tenant-location-empty-btn"
                                onClick={clearBrowseFilters}
                            >
                                Clear search & filters
                            </button>
                        )}
                        {activeTab === "favorites" && isSearchActive && (
                            <button
                                type="button"
                                className="tenant-location-empty-btn"
                                onClick={() => setSearchQuery("")}
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tenant-property-grid">
                        {displayProperties.map(renderPropertyCard)}
                    </div>
                )}
                </div>
            </main>

            {renderPropertyModal()}

            <ProfileModal
                user={user}
                open={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                onSave={handleProfileSave}
            />
        </div>
    );
}

export default TenantDashboard;
