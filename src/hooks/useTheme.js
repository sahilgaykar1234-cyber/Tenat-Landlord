import { useState, useEffect } from "react";
import { getStoredTheme, setStoredTheme, applyTheme } from "../utils/theme";

export function useTheme() {
    const [theme, setTheme] = useState(() => getStoredTheme());

    useEffect(() => {
        setStoredTheme(theme);
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    };

    return { theme, toggleTheme, setTheme, isDark: theme === "dark" };
}
