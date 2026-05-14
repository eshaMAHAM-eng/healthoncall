/**
 * Unified appearance: localStorage `hoc-settings` JSON { dark: boolean }.
 * Migrates legacy `hoc_theme` (dark/light). Applies `dark-mode` + `dk` + html.hoc-dark for compatibility across dashboards.
 */
(function () {
    try {
        var raw = localStorage.getItem("hoc-settings");
        var s = raw ? JSON.parse(raw) : {};
        if (!raw) {
            var leg = localStorage.getItem("hoc_theme");
            if (leg === "dark") {
                s.dark = true;
                localStorage.setItem("hoc-settings", JSON.stringify(s));
                localStorage.removeItem("hoc_theme");
            } else if (leg === "light") {
                s.dark = false;
                localStorage.setItem("hoc-settings", JSON.stringify(s));
                localStorage.removeItem("hoc_theme");
            }
        }
        if (s && s.dark) {
            document.documentElement.classList.add("hoc-dark");
        }
    } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", function () {
    try {
        var raw = localStorage.getItem("hoc-settings");
        var s = raw ? JSON.parse(raw) : {};
        if (!raw) {
            var leg = localStorage.getItem("hoc_theme");
            if (leg === "dark") {
                s.dark = true;
                localStorage.setItem("hoc-settings", JSON.stringify(s));
                localStorage.removeItem("hoc_theme");
            }
        }
        if (s && s.dark) {
            document.body.classList.add("dark-mode");
            document.body.classList.add("dk");
            document.documentElement.classList.add("hoc-dark");
        } else {
            document.body.classList.remove("dark-mode");
            document.body.classList.remove("dk");
            document.documentElement.classList.remove("hoc-dark");
        }
    } catch (e) {}
});
