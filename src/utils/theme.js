const THEME_KEY = "propmanager-theme";

export function getStoredTheme() {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setStoredTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme) {
    document.documentElement.dataset.dashboardTheme = theme;
}
