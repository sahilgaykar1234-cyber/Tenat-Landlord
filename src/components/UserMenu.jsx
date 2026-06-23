import { useState, useEffect, useRef, Children, cloneElement } from "react";
import ThemeToggle from "./ThemeToggle";

function UserMenu({ userName, userRole, userInitial, theme, onToggleTheme, onLogout, children }) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const closeMenu = () => setOpen(false);

    return (
        <div className="dash-user-menu-wrap" ref={menuRef}>
            <button
                type="button"
                className="dash-user-chip clickable"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <div className="dash-user-avatar">{userInitial}</div>
                <div className="dash-user-meta">
                    <span>{userName}</span>
                    <small>{userRole}</small>
                </div>
                <span className="dash-user-chevron">▾</span>
            </button>

            {open && (
                <div className="dash-user-dropdown" role="menu">
                    {Children.map(children, (child) => {
                        if (!child) return null;
                        return cloneElement(child, {
                            role: "menuitem",
                            onClick: (event) => {
                                closeMenu();
                                child.props.onClick?.(event);
                            }
                        });
                    })}
                    {children ? <div className="dash-user-dropdown-divider" /> : null}
                    <ThemeToggle theme={theme} onToggle={onToggleTheme} inDropdown />
                    <div className="dash-user-dropdown-divider" />
                    <button
                        type="button"
                        className="dash-dropdown-danger"
                        role="menuitem"
                        onClick={() => {
                            closeMenu();
                            onLogout();
                        }}
                    >
                        🚪 Logout
                    </button>
                </div>
            )}
        </div>
    );
}

export default UserMenu;
