(function () {
    "use strict";

    var STORAGE_KEY = "aozoratex-theme";
    var LIGHT = "light";
    var DARK = "dark";

    function getPreferredTheme() {
        var saved = "";
        try {
            saved = String(localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
        } catch (_error) {
            saved = "";
        }
        if (saved === LIGHT || saved === DARK) {
            return saved;
        }

        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? DARK : LIGHT;
    }

    function applyTheme(theme) {
        var normalized = theme === DARK ? DARK : LIGHT;
        document.documentElement.setAttribute("data-app-theme", normalized);
        try {
            localStorage.setItem(STORAGE_KEY, normalized);
        } catch (_error) {
            // Ignore storage errors in private mode.
        }
        return normalized;
    }

    function syncBuiltInThemeControls(theme) {
        var modeInputs = document.querySelectorAll("input[name='theme']");
        var hasBuiltInThemeInputs = modeInputs.length > 0;
        modeInputs.forEach(function (input) {
            if (!input || !input.value) return;
            if (input.value === "intermediate") return;
            input.checked = input.value === theme;
        });

        var body = document.body;
        if (body) {
            body.classList.remove("light-theme", "dark-theme");
            if (hasBuiltInThemeInputs) {
                body.classList.add(theme + "-theme");
            }
        }
    }

    function updateButtonLabel(button, theme) {
        if (!button) return;
        button.textContent = theme === DARK ? "Theme: Dark" : "Theme: Light";
        button.setAttribute("aria-label", "Toggle dark and light theme");
        button.setAttribute("title", "Toggle dark and light theme");
    }

    function ensureToggleButton(initialTheme) {
        var existing = document.getElementById("themeCommonToggle");
        if (existing) {
            updateButtonLabel(existing, initialTheme);
            return existing;
        }

        var button = document.createElement("button");
        button.id = "themeCommonToggle";
        button.type = "button";
        button.className = "theme-toggle-btn";
        updateButtonLabel(button, initialTheme);

        button.addEventListener("click", function () {
            var current = document.documentElement.getAttribute("data-app-theme") === DARK ? DARK : LIGHT;
            var next = current === DARK ? LIGHT : DARK;
            var applied = applyTheme(next);
            syncBuiltInThemeControls(applied);
            updateButtonLabel(button, applied);
        });

        document.body.appendChild(button);
        return button;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var initial = applyTheme(getPreferredTheme());
        syncBuiltInThemeControls(initial);
        var button = ensureToggleButton(initial);

        var modeInputs = document.querySelectorAll("input[name='theme']");
        modeInputs.forEach(function (input) {
            input.addEventListener("change", function () {
                if (input.value !== LIGHT && input.value !== DARK) {
                    return;
                }
                var applied = applyTheme(input.value);
                syncBuiltInThemeControls(applied);
                updateButtonLabel(button, applied);
            });
        });
    });
})();
