function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return {
        r: parseInt(value.substring(0, 2), 16),
        g: parseInt(value.substring(2, 4), 16),
        b: parseInt(value.substring(4, 6), 16),
    };
}

function rgbToHsv({ r, g, b }) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rr) {
            h = 60 * (((gg - bb) / delta) % 6);
        } else if (max === gg) {
            h = 60 * ((bb - rr) / delta + 2);
        } else {
            h = 60 * ((rr - gg) / delta + 4);
        }
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max;
    return { h, s, v };
}

function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const arr = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return arr[0] * 0.2126 + arr[1] * 0.7152 + arr[2] * 0.0722;
}

function contrast(bg, fg) {
    const l1 = luminance(bg);
    const l2 = luminance(fg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function createSchemes(data) {
    const schemes = [];
    const seen = new Set();
    const categories = data.categories || [];
    const palettes = data.palettes || {};

    categories.forEach((category) => {
        const lights = palettes[category.lights] || [];
        const darks = palettes[category.darks] || [];

        lights.forEach((bg) => {
            darks.forEach((fg) => {
                const ratio = contrast(bg.c, fg.c);
                if (ratio >= 4.5) {
                    const item = {
                        mode: "light",
                        category: category.name,
                        name: `${bg.n} × ${fg.n}`,
                        bg: bg.c,
                        fg: fg.c,
                        contrast: ratio,
                    };
                    const key = `light|${item.bg}|${item.fg}|${item.name}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        schemes.push(item);
                    }
                }
            });
        });

        darks.forEach((bg) => {
            lights.forEach((fg) => {
                const ratio = contrast(bg.c, fg.c);
                if (ratio >= 4.5) {
                    const item = {
                        mode: "dark",
                        category: category.name,
                        name: `${bg.n} × ${fg.n}`,
                        bg: bg.c,
                        fg: fg.c,
                        contrast: ratio,
                    };
                    const key = `dark|${item.bg}|${item.fg}|${item.name}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        schemes.push(item);
                    }
                }
            });
        });
    });

    const presets = (data.preset_modes && data.preset_modes.sepia) || [];
    presets.forEach((preset) => {
        const ratio = contrast(preset.bg, preset.fg);
        const item = {
            mode: "preset",
            category: "Preset",
            name: preset.name,
            bg: preset.bg,
            fg: preset.fg,
            contrast: ratio,
        };
        const key = `preset|${item.bg}|${item.fg}|${item.name}`;
        if (!seen.has(key)) {
            seen.add(key);
            schemes.push(item);
        }
    });

    return schemes;
}

function sortSchemes(items, type) {
    const arr = [...items];
    if (type === "contrast") {
        arr.sort((a, b) => b.contrast - a.contrast || a.name.localeCompare(b.name, "ja"));
        return arr;
    }
    if (type === "category") {
        arr.sort((a, b) => a.category.localeCompare(b.category, "ja") || a.name.localeCompare(b.name, "ja"));
        return arr;
    }

    arr.sort((a, b) => {
        const ah = rgbToHsv(hexToRgb(a.bg));
        const bh = rgbToHsv(hexToRgb(b.bg));
        if (ah.h !== bh.h) return ah.h - bh.h;
        if (ah.s !== bh.s) return ah.s - bh.s;
        if (ah.v !== bh.v) return ah.v - bh.v;
        return a.name.localeCompare(b.name, "ja");
    });
    return arr;
}

function filterSchemes(items, search, mode) {
    const q = (search || "").trim().toLowerCase();
    return items.filter((item) => {
        const modeOk = mode === "all" || item.mode === mode;
        if (!modeOk) return false;
        if (!q) return true;
        const hay = `${item.name} ${item.category} ${item.bg} ${item.fg}`.toLowerCase();
        return hay.includes(q);
    });
}

function renderCards(items, sampleText) {
    const grid = document.getElementById("color-grid");
    grid.innerHTML = "";

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "card";
        card.style.backgroundColor = item.bg;
        card.style.color = item.fg;

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.innerHTML = `
            <strong>${item.name}</strong>
            <div>${item.category} / ${item.mode}</div>
            <div>BG: ${item.bg} / FG: ${item.fg}</div>
            <div>Contrast: ${item.contrast.toFixed(2)}:1</div>
        `;

        const sample = document.createElement("div");
        sample.className = "sample";
        sample.textContent = sampleText;

        const actions = document.createElement("div");
        actions.className = "actions";
        const link = document.createElement("a");
        link.href = `/?bg=${encodeURIComponent(item.bg)}&fg=${encodeURIComponent(item.fg)}&mode=${encodeURIComponent(item.mode === "preset" ? "light" : item.mode)}`;
        link.textContent = "Web UIで使う";
        actions.appendChild(link);

        card.appendChild(meta);
        card.appendChild(sample);
        card.appendChild(actions);
        grid.appendChild(card);
    });
}

function getPaletteData() {
    if (window.COLOR_PALETTE_DATA) {
        return Promise.resolve(window.COLOR_PALETTE_DATA);
    }
    return fetch("/static/color-palettes.json").then((r) => r.json());
}

function init() {
    const modeEl = document.getElementById("mode-filter");
    const sortEl = document.getElementById("sort-filter");
    const searchEl = document.getElementById("search-filter");
    const countEl = document.getElementById("count");
    const titleEl = document.getElementById("page-title");

    getPaletteData()
        .then((data) => {
            const allSchemes = createSchemes(data);
            const sampleText = data.sample_text || "Sample Text";

            function refresh() {
                const filtered = filterSchemes(allSchemes, searchEl.value, modeEl.value);
                const sorted = sortSchemes(filtered, sortEl.value);
                renderCards(sorted, sampleText);
                countEl.textContent = `${sorted.length} 件`;
                titleEl.textContent = `Color Scheme 一覧（統合版）`;
            }

            modeEl.addEventListener("change", refresh);
            sortEl.addEventListener("change", refresh);
            searchEl.addEventListener("input", refresh);
            refresh();
        })
        .catch((error) => {
            countEl.textContent = "読み込み失敗";
            console.error(error);
        });
}

document.addEventListener("DOMContentLoaded", init);

