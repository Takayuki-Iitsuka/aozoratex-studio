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

function setTheme(theme) {
    document.body.classList.remove("light-theme", "dark-theme", "intermediate-theme");
    document.body.classList.add(`${theme}-theme`);
}

function setWashi(enabled) {
    document.body.classList.toggle("washi-active", enabled);
}

const MAX_SCHEMES = 100;

const pageState = {
    selectedFont: "Yu Mincho",
};

function schemeSimilarityKey(item) {
    const hsv = rgbToHsv(hexToRgb(item.bg));
    return [
        item.category,
        item.mode,
        item.bg,
        item.fg,
        Math.floor(hsv.h),
    ].join("|");
}

function limitSchemesBalanced(items, limit = MAX_SCHEMES) {
    if (!Array.isArray(items) || items.length <= limit) {
        return items;
    }

    const deduped = [];
    const seen = new Set();
    items.forEach((item) => {
        const key = schemeSimilarityKey(item);
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(item);
    });

    if (deduped.length <= limit) {
        return deduped;
    }

    const groups = new Map();
    deduped.forEach((item) => {
        const key = `${item.category}|${item.mode}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });

    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "ja"));
    keys.forEach((key) => {
        const bucket = groups.get(key) || [];
        bucket.sort((a, b) => {
            const ah = rgbToHsv(hexToRgb(a.bg)).h;
            const bh = rgbToHsv(hexToRgb(b.bg)).h;
            if (ah !== bh) return ah - bh;
            return b.contrast - a.contrast;
        });
    });

    const base = Math.max(1, Math.floor(limit / Math.max(1, keys.length)));
    const quotas = new Map(keys.map((key) => [key, Math.min(base, (groups.get(key) || []).length)]));
    let assigned = Array.from(quotas.values()).reduce((sum, value) => sum + value, 0);

    while (assigned < limit) {
        let progressed = false;
        keys.forEach((key) => {
            const bucket = groups.get(key) || [];
            const quota = quotas.get(key) || 0;
            if (assigned >= limit) return;
            if (quota >= bucket.length) return;
            quotas.set(key, quota + 1);
            assigned += 1;
            progressed = true;
        });
        if (!progressed) break;
    }

    const pickedGroups = new Map();
    keys.forEach((key) => {
        const bucket = groups.get(key) || [];
        const quota = quotas.get(key) || 0;
        if (quota <= 0) {
            pickedGroups.set(key, []);
            return;
        }
        if (quota >= bucket.length) {
            pickedGroups.set(key, bucket);
            return;
        }
        if (quota === 1) {
            pickedGroups.set(key, [bucket[Math.floor(bucket.length / 2)]]);
            return;
        }

        const sampled = [];
        const maxIdx = bucket.length - 1;
        for (let i = 0; i < quota; i += 1) {
            const idx = Math.round((i * maxIdx) / (quota - 1));
            sampled.push(bucket[idx]);
        }
        pickedGroups.set(key, sampled);
    });

    const indexMap = new Map(keys.map((key) => [key, 0]));
    const selected = [];
    while (selected.length < limit) {
        let progressed = false;
        keys.forEach((key) => {
            if (selected.length >= limit) return;
            const bucket = pickedGroups.get(key) || [];
            const idx = indexMap.get(key) || 0;
            if (idx >= bucket.length) return;
            selected.push(bucket[idx]);
            indexMap.set(key, idx + 1);
            progressed = true;
        });
        if (!progressed) break;
    }

    return selected.slice(0, limit);
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

    const intermediatePresets =
        (data.preset_modes && (data.preset_modes.intermediate || data.preset_modes.sepia)) || [];
    intermediatePresets.forEach((preset) => {
        const ratio = contrast(preset.bg, preset.fg);
        const item = {
            mode: "intermediate",
            category: "Intermediate",
            name: preset.name,
            bg: preset.bg,
            fg: preset.fg,
            contrast: ratio,
        };
        const key = `intermediate|${item.bg}|${item.fg}|${item.name}`;
        if (!seen.has(key)) {
            seen.add(key);
            schemes.push(item);
        }
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

    return limitSchemesBalanced(schemes, MAX_SCHEMES);
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
        sample.style.fontFamily = `"${pageState.selectedFont}", "Yu Mincho", "MS Mincho", serif`;
        sample.textContent = sampleText;

        const actions = document.createElement("div");
        actions.className = "actions";
        const link = document.createElement("a");
        const targetMode = (item.mode === "preset" || item.mode === "intermediate") ? "intermediate" : item.mode;
        link.href = `/?bg=${encodeURIComponent(item.bg)}&fg=${encodeURIComponent(item.fg)}&mode=${encodeURIComponent(targetMode)}&font=${encodeURIComponent(pageState.selectedFont)}`;
        link.textContent = "Web UIで使う";
        actions.appendChild(link);

        card.appendChild(meta);
        card.appendChild(sample);
        card.appendChild(actions);
        grid.appendChild(card);
    });
}

async function loadFonts(refresh) {
    const query = refresh ? "?refresh=1" : "";
    const response = await fetch(`/api/lualatex-fonts${query}`);
    const payload = await response.json();
    const fonts = Array.isArray(payload.fonts) ? payload.fonts : [];
    const select = document.getElementById("font-filter");
    const status = document.getElementById("font-status");

    select.innerHTML = "";
    if (fonts.length === 0) {
        const fallback = pageState.selectedFont || "Yu Mincho";
        const option = document.createElement("option");
        option.value = fallback;
        option.textContent = `${fallback} (固定)`;
        select.appendChild(option);
        pageState.selectedFont = fallback;
        status.textContent = "フォント一覧の取得に失敗したため、現在値を使用します。";
        return;
    }

    fonts.forEach((font) => {
        const option = document.createElement("option");
        option.value = font.name;
        option.textContent = font.recommended
            ? `${font.display_name} ★`
            : font.display_name;
        select.appendChild(option);
    });

    const preferred = pageState.selectedFont || fonts[0].name;
    const hasPreferred = fonts.some((item) => item.name === preferred);
    pageState.selectedFont = hasPreferred ? preferred : fonts[0].name;
    select.value = pageState.selectedFont;

    status.textContent = payload.lualatex_available
        ? `${fonts.length}件 / LuaLaTeX: OK`
        : `${fonts.length}件 / LuaLaTeX: NG`;
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
    const fontEl = document.getElementById("font-filter");
    const fontRefreshEl = document.getElementById("font-refresh");
    const countEl = document.getElementById("count");
    const titleEl = document.getElementById("page-title");
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const washiToggle = document.getElementById("washi-toggle");

    Promise.all([getPaletteData(), loadFonts(false)])
        .then(([data]) => {
            const allSchemes = createSchemes(data);
            const sampleText = data.sample_text || "Sample Text";

            function refresh() {
                const filtered = filterSchemes(allSchemes, searchEl.value, modeEl.value);
                const sorted = sortSchemes(filtered, sortEl.value);
                renderCards(sorted, sampleText);
                countEl.textContent = `${sorted.length} 件（上限 ${MAX_SCHEMES}）`;
                titleEl.textContent = "Color Scheme 一覧（統合版）";
            }

            modeEl.addEventListener("change", refresh);
            sortEl.addEventListener("change", refresh);
            searchEl.addEventListener("input", refresh);
            fontEl.addEventListener("change", () => {
                pageState.selectedFont = fontEl.value || "Yu Mincho";
                refresh();
            });
            fontRefreshEl.addEventListener("click", () => {
                loadFonts(true)
                    .then(refresh)
                    .catch((error) => {
                        console.error(error);
                    });
            });

            themeRadios.forEach((radio) => {
                radio.addEventListener("change", (e) => setTheme(e.target.value));
            });
            washiToggle.addEventListener("change", (e) => setWashi(e.target.checked));

            refresh();
        })
        .catch((error) => {
            countEl.textContent = "読み込み失敗";
            console.error(error);
        });

    const currentTheme = document.querySelector('input[name="theme"]:checked')?.value || "light";
    setTheme(currentTheme);
    if (washiToggle) {
        setWashi(washiToggle.checked);
    }
}

document.addEventListener("DOMContentLoaded", init);

