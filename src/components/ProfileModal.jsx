import { useEffect, useState } from "react";
import "./ProfileModal.css";

function ProfileModal({ user, open, onClose, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "" });

    const userInitial = (user?.name || "U").charAt(0).toUpperCase();

    useEffect(() => {
        if (!open || !user) return;
        setForm({
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || ""
        });
        setIsEditing(false);
    }, [open, user]);

    if (!open || !user) return null;

    const handleChange = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSave(form);
        setIsEditing(false);
    };

    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
                <div className="profile-modal-header">
                    <h2>{isEditing ? "Edit Profile" : "My Profile"}</h2>
                    <button type="button" className="profile-modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="profile-modal-body">
                    <div className="profile-modal-avatar">{userInitial}</div>

                    {isEditing ? (
                        <form className="profile-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <div className="profile-role-field">
                                    <span className="profile-role-badge">{user.role}</span>
                                    <span className="profile-role-note">
                                        Account type cannot be changed
                                    </span>
                                </div>
                            </div>
                            <div className="profile-form-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setIsEditing(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="profile-details">
                                <div className="profile-detail-row">
                                    <span className="profile-label">Name</span>
                                    <span className="profile-value">{user.name}</span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Email</span>
                                    <span className="profile-value">{user.email}</span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Phone</span>
                                    <span className="profile-value">{user.phone}</span>
                                </div>
                                <div className="profile-detail-row">
                                    <span className="profile-label">Role</span>
                                    <span className="profile-role-badge">{user.role}</span>
                                </div>
                            </div>
                            <div className="profile-form-actions">
                                <button
                                    type="button"
                                    className="btn-submit"
                                    onClick={() => setIsEditing(true)}
                                >
                                    ✏️ Edit Profile
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProfileModal;
