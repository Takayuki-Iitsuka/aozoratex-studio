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

// 背景プレビューの切替。
// "none" = 背景なし / "noise" = SVGノイズによる簡易和紙 / それ以外 = 和紙画像のURL
function setBackground(value) {
    document.body.classList.remove("washi-active", "washi-image-active");
    document.body.style.removeProperty("--washi-image");
    if (value === "noise") {
        document.body.classList.add("washi-active");
    } else if (value && value !== "none") {
        document.body.classList.add("washi-image-active");
        document.body.style.setProperty("--washi-image", `url("${value}")`);
    }
}

const MAX_SCHEMES = 36;

const pageState = {
    selectedFont: "Yu Mincho",
};
const WEB_UI_MESSAGE_TYPE = "AOZORATEX_APPLY_COLOR_SCHEME";
const ACK_MESSAGE_TYPE = "AOZORATEX_APPLY_COLOR_SCHEME_ACK";
const SETTINGS_CHANNEL_NAME = "aozoratex-settings";
const PENDING_SCHEME_KEY = "aozoratex_pending_color_scheme";
const ACK_TIMEOUT_MS = 400;

// BroadcastChannel 非対応環境向けの後方互換経路（iframe親 / opener への postMessage）
function notifyWebUiFromCatalog(scheme) {
    const payload = {
        type: WEB_UI_MESSAGE_TYPE,
        scheme,
    };

    let sent = false;
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin);
            sent = true;
        }
    } catch (_error) {
        // 失敗時は opener へフォールバック
    }

    try {
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin);
            sent = true;
        }
    } catch (_error) {
        // 送信不可（保留保存にフォールバック）
    }

    return sent;
}

let toastTimer = null;
function showToast(message) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.hidden = true;
    }, 3500);
}

function savePendingScheme(scheme) {
    try {
        localStorage.setItem(PENDING_SCHEME_KEY, JSON.stringify(scheme));
        return true;
    } catch (_error) {
        return false;
    }
}

function reportApplyResult(scheme, delivered) {
    if (delivered) {
        showToast(`「${scheme.name}」を設定とプレビューに反映しました。`);
    } else if (savePendingScheme(scheme)) {
        showToast(`「${scheme.name}」を反映しました（アプリを次に開いたときに適用されます）。`);
    } else {
        showToast("反映できませんでした。アプリのタブを開いてから再度お試しください。");
    }
}

// 「設定に反映」の本体。ページ遷移は行わず、BroadcastChannel でアプリ本体へ通知する。
// アプリからの ACK が返らない場合は localStorage に保留保存し、次回アプリ起動時に適用される。
function applySchemeToApp(scheme) {
    let channel = null;
    try {
        channel = new BroadcastChannel(SETTINGS_CHANNEL_NAME);
    } catch (_error) {
        channel = null;
    }

    if (!channel) {
        reportApplyResult(scheme, notifyWebUiFromCatalog(scheme));
        return;
    }

    let acked = false;
    channel.onmessage = (event) => {
        if (event.data && event.data.type === ACK_MESSAGE_TYPE) {
            acked = true;
        }
    };
    channel.postMessage({ type: WEB_UI_MESSAGE_TYPE, scheme });

    setTimeout(() => {
        channel.close();
        reportApplyResult(scheme, acked);
    }, ACK_TIMEOUT_MS);
}

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

    // intermediate 専用プリセットが定義されている場合のみ生成する。
    // sepia へのフォールバックは preset カードとの重複（古紙色が2枚出る）を招くため行わない
    const intermediatePresets = (data.preset_modes && data.preset_modes.intermediate) || [];
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

        // 説明部はページテーマに追従せず常に固定配色（ライトニュートラル）で表示する
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.innerHTML = `
            <strong>${item.name}</strong>
            <div>${item.category} / ${item.mode}</div>
            <div>BG: <span class="swatch" style="background-color:${item.bg}"></span>${item.bg} / FG: <span class="swatch" style="background-color:${item.fg}"></span>${item.fg}</div>
            <div>Contrast: ${item.contrast.toFixed(2)}:1</div>
        `;

        const sample = document.createElement("div");
        sample.className = "sample";
        sample.style.fontFamily = `"${pageState.selectedFont}", "Yu Mincho", "MS Mincho", serif`;
        const sampleInner = document.createElement("span");
        sampleInner.className = "sample-text";
        sampleInner.textContent = sampleText;
        sample.appendChild(sampleInner);

        const actions = document.createElement("div");
        actions.className = "actions";
        const targetMode = (item.mode === "preset" || item.mode === "intermediate") ? "intermediate" : item.mode;
        const applyButton = document.createElement("button");
        applyButton.type = "button";
        applyButton.className = "apply-button";
        applyButton.textContent = "設定に反映";
        applyButton.addEventListener("click", () => {
            applySchemeToApp({
                name: item.name,
                mode: targetMode,
                bg: item.bg,
                fg: item.fg,
                font: pageState.selectedFont,
            });
        });
        actions.appendChild(applyButton);

        card.appendChild(meta);
        card.appendChild(sample);
        card.appendChild(actions);
        grid.appendChild(card);
    });
}

// フォント一覧の取得。失敗しても throw せず固定フォントにフォールバックする
// （このページの操作系がフォントAPIの成否に巻き込まれないようにするため）
async function loadFonts(refresh) {
    const select = document.getElementById("font-filter");
    const status = document.getElementById("font-status");

    let fonts = [];
    let lualatexAvailable = false;
    try {
        const query = refresh ? "?refresh=1" : "";
        const response = await fetch(`/api/lualatex-fonts${query}`);
        const payload = await response.json();
        fonts = Array.isArray(payload.fonts) ? payload.fonts : [];
        lualatexAvailable = Boolean(payload.lualatex_available);
    } catch (error) {
        console.error("フォント一覧の取得に失敗:", error);
    }

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

    status.textContent = lualatexAvailable
        ? `${fonts.length}件 / LuaLaTeX: OK`
        : `${fonts.length}件 / LuaLaTeX: NG`;
}

// 和紙背景画像の一覧を取得し、プレビュー用URL（/assets/washi/<ファイル名>）へ変換する。
// 取得できない環境では空配列を返し、「なし / 和紙（ノイズ）」のみで動作する
async function loadWashiAssets() {
    try {
        const response = await fetch("/api/background-assets");
        const payload = await response.json();
        const washi = Array.isArray(payload.washi) ? payload.washi : [];
        return washi
            .map((item) => {
                const file = String(item.path || "").split("/").pop();
                if (!file) return null;
                return {
                    name: item.name || file,
                    url: `/assets/washi/${encodeURIComponent(file)}`,
                };
            })
            .filter(Boolean);
    } catch (_error) {
        return [];
    }
}

function getPaletteData() {
    return fetch("/static/color-palettes.json").then((r) => r.json());
}

function init() {
    const modeEl = document.getElementById("mode-filter");
    const sortEl = document.getElementById("sort-filter");
    const searchEl = document.getElementById("search-filter");
    const fontEl = document.getElementById("font-filter");
    const fontRefreshEl = document.getElementById("font-refresh");
    const countEl = document.getElementById("count");
    const backgroundEl = document.getElementById("background-filter");
    const themeRadios = document.querySelectorAll('input[name="theme"]');

    let allSchemes = null;
    let sampleText = "Sample Text";

    function refresh() {
        if (!allSchemes) return; // パレットデータ未着の間は何もしない
        const filtered = filterSchemes(allSchemes, searchEl.value, modeEl.value);
        const sorted = sortSchemes(filtered, sortEl.value);
        renderCards(sorted, sampleText);
        if (countEl) countEl.textContent = `${sorted.length} 件`;
    }

    // イベントリスナはデータ取得の成否に依存させず、同期的に登録する
    // （API取得失敗時にテーマ・背景切替が死なないようにするため）
    modeEl.addEventListener("change", refresh);
    sortEl.addEventListener("change", refresh);
    searchEl.addEventListener("input", refresh);
    fontEl.addEventListener("change", () => {
        pageState.selectedFont = fontEl.value || "Yu Mincho";
        refresh();
    });
    fontRefreshEl.addEventListener("click", () => {
        loadFonts(true).then(refresh);
    });
    themeRadios.forEach((radio) => {
        radio.addEventListener("change", (e) => setTheme(e.target.value));
    });
    if (backgroundEl) {
        backgroundEl.addEventListener("change", () => setBackground(backgroundEl.value));
    }

    const currentTheme = document.querySelector('input[name="theme"]:checked')?.value || "light";
    setTheme(currentTheme);
    setBackground(backgroundEl ? backgroundEl.value : "none");

    loadFonts(false).then(refresh);

    getPaletteData()
        .then((data) => {
            allSchemes = createSchemes(data);
            sampleText = data.sample_text || sampleText;
            refresh();
        })
        .catch((error) => {
            if (countEl) countEl.textContent = "読み込み失敗";
            console.error(error);
        });

    loadWashiAssets().then((images) => {
        if (!backgroundEl) return;
        images.forEach((image) => {
            const option = document.createElement("option");
            option.value = image.url;
            option.textContent = image.name;
            backgroundEl.appendChild(option);
        });
    });
}

document.addEventListener("DOMContentLoaded", init);
