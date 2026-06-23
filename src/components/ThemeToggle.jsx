import "./ThemeToggle.css";

function ThemeToggle({ theme, onToggle, inDropdown = false }) {
    const isDark = theme === "dark";

    if (inDropdown) {
        return (
            <button
                type="button"
                className="dash-dropdown-theme"
                role="menuitem"
                onClick={onToggle}
            >
                <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
                {isDark ? "Light mode" : "Dark mode"}
            </button>
        );
    }

    return (
        <button
            type="button"
            className="dash-theme-toggle"
            onClick={onToggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
        >
            <span className="dash-theme-toggle-icon" aria-hidden="true">
                {isDark ? "☀️" : "🌙"}
            </span>
            <span className="dash-theme-toggle-label">{isDark ? "Light" : "Dark"}</span>
        </button>
    );
}

export default ThemeToggle;
