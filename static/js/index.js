(function () {
    "use strict";

    // UI state is intentionally centralized so customization points are easy to track.
    const CLIENT_ID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const COMPILE_LOG_POLL_INTERVAL_MS = 700;

    const RECOMMENDED_FONT = "IPAmjMincho";
    const SERVER_UNREACHABLE_MESSAGE = "serverに接続できません";
    const DEFAULT_COLOR_PAIR = { bg: "#FFFFFF", fg: "#000000" };
    const DEFAULT_DEVICE_FONT_SIZES = {
        smart: 10.5,
        tablet: 13.5,
        pc: 13.5,
    };
    const COLOR_SCHEME_MESSAGE_TYPE = "AOZORATEX_APPLY_COLOR_SCHEME";
    const SIZE_REFERENCE_SAMPLE = String.raw`\section*{LuaLaTeX 日本語環境・完全文字化けテスト}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{1. CJK 拡張漢字（Ext-A〜F）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

𠮷 𠯁 𠯃 𠯄 𠯅 𠯆 𠯇 𠯈 𠯉 𠯊
𡈽 𡉀 𡉁 𡉂 𡉃 𡉄 𡉅 𡉆 𡉇 𡉈
𤔣 𤔤 𤔥 𤔦 𤔧 𤔨 𤔩 𤔪 𤔫 𤔬
𩸽 𩹀 𩹁 𩹂 𩹃 𩹄 𩹅 𩹆 𩹇 𩹈
𪘂 𪘃 𪘄 𪘅 𪘆 𪘇 𪘈 𪘉 𪘊 𪘋

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{2. 互換漢字（CJK Compatibility Ideographs）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

﨑 神 祥 福 靖 精 羽 﨟 蘒 﨡
諸 﨣 﨤 逸 都 﨧 﨨 﨩
懲 敏 既 暑 梅 海 渚 漢 煮 爫
琢 碑 社 祉 祈 祐 祖 祝 禍 禎
穀 突 節 練 縉 繁 署 者 臭 艹
艹 著 褐 視 謁 謹 賓 贈 辶 逸
難 響 頻 恵 𤋮 舘 﩮 﩯 並 况

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{3. 異体字セレクタ（IVS）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

辻󠄀 辻󠄁 辻󠄂 辻󠄃 辻󠄄
葛󠄀 葛󠄁 葛󠄂 葛󠄃 葛󠄄
髙󠄀 髙󠄁 髙󠄂 髙󠄃 髙󠄄
鷗󠄀 鷗󠄁 鷗󠄂 鷗󠄃 鷗󠄄
齋󠄀 齋󠄁 齋󠄂 齋󠄃 齋󠄄

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{4. 絵文字（Emoji）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

{\emoji 😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚}
{\emoji 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 🙄 😏 😣 😥}
{\emoji 😮‍💨 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😢 😭 😱 😖 😞 😓 😩 😫 🥱 😴}
{\emoji 🤤 😪 😵 😵‍💫 🤯 🤒 🤕 🤢 🤮 🤧 😷 🥵 🥶 🥴 🤠 🥳}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{5. Combining（合成文字）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

á é í ó ú
à è ì ò ù
ä ë ï ö ü
ñ ã õ
が ぎ ぐ げ ご
ざ じ ず ぜ ぞ
だ ぢ づ で ど
ぱ ぴ ぷ ぺ ぽ

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{6. 外字（PUA）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

         
         
         
󰀀 󰀁 󰀂 󰀃 󰀄 󰀅 󰀆 󰀇 󰀈 󰀉
󱀀 󱀁 󱀂 󱀃 󱀄 󱀅 󱀆 󱀇 󱀈 󱀉

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{7. 囲み文字・単位記号}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

㊀ ㊁ ㊂ ㊃ ㊄ ㊅ ㊆ ㊇ ㊈ ㊉
㊤ ㊥ ㊦ ㊧ ㊨
㌕ ㌖ ㌗ ㌘ ㌙ ㌚ ㌛ ㌜ ㌝ ㌞ ㌟
㍉ ㍊ ㍋ ㍌ ㍍ ㍎ ㍏ ㍐ ㍑ ㍒ ㍓ ㍔ ㍕ ㍖ ㍗

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{8. 変体仮名・仮名拡張}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

𛀁 𛀂 𛀃 𛀄 𛀅 𛀆 𛀇 𛀈 𛀉 𛀊
𛅐 𛅑 𛅒 𛅓 𛅔 𛅕 𛅖 𛅗 𛅘 𛅙
𛅦 𛅧 𛅨 𛅩 𛅪 𛅫 𛅬 𛅭 𛅮 𛅯

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{9. 麻雀牌・囲碁・将棋などの特殊シンボル}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

🀀 🀁 🀂 🀃 🀄 🀅 🀆 🀇 🀈 🀉
🀊 🀋 🀌 🀍 🀎 🀏
☗ ☖
⚪ ⚫

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\section*{10. 古代文字（Linear B, Phoenician, Hieroglyphs）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

Linear B：
𐂀 𐂁 𐂂 𐂃 𐂄 𐂅 𐂆 𐂇 𐂈 𐂉

Phoenician：
𐤀 𐤁 𐤂 𐤃 𐤄 𐤅 𐤆 𐤇 𐤈 𐤉

Egyptian Hieroglyphs：
𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉`;

    const state = {
        sourceFiles: [],
        devices: {},
        selectedDevice: null,
        selectedFont: RECOMMENDED_FONT,
        isGenerating: false,
        availableFonts: [],
        fontMetaInfo: {
            lualatex_available: false,
            refreshed: false,
        },
        compileLogs: {
            polling: false,
            timerId: null,
            lastSeq: 0,
            receivedAny: false,
            apiUnavailable: false,
        },
        selectedColor: {
            name: "custom",
            bg: "#FFFFFF",
            fg: "#000000",
        },
        colorSamples: [],
        deviceOrientation: "portrait",
        backgroundAssets: {
            cover: [],
            washi: [],
            defaults: {
                cover: "",
                washi: "",
            },
        },
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parseSourceId(name) {
        const m = String(name).match(/^(\d+)_/);
        return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    }

    function formatDeviceLabel(label) {
        const text = String(label || "").trim();
        const dimensionTail = text.match(
            /^(.*?)(\s*\(\d+(?:\.\d+)?x\d+(?:\.\d+)?mm\)(?:\s*\/\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*mm)?)$/i
        );
        if (dimensionTail) {
            return `${dimensionTail[1].trim()}\n${dimensionTail[2].trim()}`;
        }
        return text;
    }

    function setProgressLabel(text) {
        const badge = byId("progressLabel");
        if (badge) {
            badge.textContent = text;
        }
    }

    function updateProgress(percent, label) {
        const normalized = Math.max(0, Math.min(100, Math.round(percent)));
        const progress = byId("progress");
        progress.style.width = `${normalized}%`;
        progress.setAttribute("aria-valuenow", String(normalized));
        setProgressLabel(label || `${normalized}%`);
    }

    function setText(id, text) {
        const el = byId(id);
        if (el) {
            el.textContent = text;
        }
    }

    function getSelectedSourceCount() {
        const checkedCount = document.querySelectorAll(".source-check:checked").length;
        if (checkedCount > 0) {
            return checkedCount;
        }
        return byId("sourceFile").value ? 1 : 0;
    }

    function updateSelectionSummary() {
        const selectedCount = getSelectedSourceCount();
        const selectedLabel = selectedCount > 0 ? `${selectedCount}件選択` : "未選択";
        setText("sourceSelectionBadge", selectedLabel);
        setText("summarySelectedCount", selectedLabel);

        const generateBtn = byId("generateBtn");
        if (generateBtn && !state.isGenerating) {
            generateBtn.textContent = selectedCount > 1 ? `選択した${selectedCount}件をPDF化` : "選択をPDF化";
        }
    }

    function updateConfigSummary() {
        const device = state.devices[state.selectedDevice];
        if (device) {
            const suffix = deviceSupportsOrientation(state.selectedDevice)
                ? ` / ${state.deviceOrientation === "landscape" ? "Landscape" : "Portrait"}`
                : "";
            setText("summaryDevice", `${device.label}${suffix}`);
        } else {
            setText("summaryDevice", "未選択");
        }
        setText(
            "summaryColors",
            `BG ${state.selectedColor.bg || DEFAULT_COLOR_PAIR.bg} / FG ${state.selectedColor.fg || DEFAULT_COLOR_PAIR.fg}`
        );
        if (state.selectedFont) {
            setText(
                "summaryFont",
                `${state.selectedFont} / ${formatFontSize(getDeviceFontSize(state.selectedDevice))}pt`
            );
        } else {
            setText("summaryFont", "未設定");
        }
    }

    function normalizeOrientation(value) {
        return value === "landscape" ? "landscape" : "portrait";
    }

    function deviceSupportsOrientation(deviceKey) {
        const device = state.devices[deviceKey];
        return Boolean(device && device.supports_orientation);
    }

    function getDeviceOrientation() {
        if (!deviceSupportsOrientation(state.selectedDevice)) {
            return "portrait";
        }
        const checked = document.querySelector("input[name='deviceOrientation']:checked");
        return normalizeOrientation(checked ? checked.value : state.deviceOrientation);
    }

    function setDeviceOrientation(orientation) {
        const normalized = normalizeOrientation(orientation);
        state.deviceOrientation = normalized;
        const radio = document.querySelector(`input[name='deviceOrientation'][value='${normalized}']`);
        if (radio) {
            radio.checked = true;
        }
    }

    function getBackgroundRenderMode() {
        const checked = document.querySelector("input[name='backgroundRenderMode']:checked");
        return checked && checked.value === "image" ? "image" : "tikz";
    }

    function setBackgroundRenderMode(mode) {
        const normalized = mode === "image" ? "image" : "tikz";
        const radio = document.querySelector(`input[name='backgroundRenderMode'][value='${normalized}']`);
        if (radio) {
            radio.checked = true;
        }
    }

    function formatOpacityValue(value, fallback) {
        const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
        return numeric.toFixed(2);
    }

    function updateOpacityValueLabel(inputId, valueId, fallback) {
        const input = byId(inputId);
        const label = byId(valueId);
        if (!input || !label) {
            return;
        }
        label.textContent = formatOpacityValue(input.value, fallback);
    }

    function renderBackgroundAssetSelect(selectId, items, fallbackPath) {
        const select = byId(selectId);
        if (!select) {
            return;
        }
        const previousValue = select.value;
        const normalizedItems = Array.isArray(items) ? items : [];
        select.innerHTML = "";

        if (normalizedItems.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "画像がありません";
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        normalizedItems.forEach((item) => {
            const option = document.createElement("option");
            option.value = String(item.path || "");
            option.textContent = String(item.name || item.path || "");
            select.appendChild(option);
        });

        const desiredValue = previousValue || fallbackPath || String(normalizedItems[0].path || "");
        select.value = desiredValue;
        if (select.value !== desiredValue) {
            select.value = String(normalizedItems[0].path || "");
        }
        select.disabled = false;
    }

    function getSelectedBackgroundAssetPath(kind) {
        const selectId = kind === "cover" ? "coverImagePath" : "washiImagePath";
        const select = byId(selectId);
        const defaults = state.backgroundAssets && state.backgroundAssets.defaults
            ? state.backgroundAssets.defaults
            : { cover: "", washi: "" };
        return String(
            (select && select.value)
            || defaults[kind]
            || ""
        );
    }

    function normalizeCompileLogText(text) {
        return String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    }

    function setCompileLogText(text) {
        const terminal = byId("compileLogTerminal");
        if (!terminal) return;
        terminal.textContent = normalizeCompileLogText(text);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function appendCompileLogLine(line) {
        const terminal = byId("compileLogTerminal");
        if (!terminal || line == null) return;
        terminal.textContent += normalizeCompileLogText(line);
        state.compileLogs.receivedAny = true;
        terminal.scrollTop = terminal.scrollHeight;
    }

    function isCompileLogApiUnavailableError(error) {
        const message = String((error && error.message) || error || "");
        return Number(error && error.status) === 404 || message.includes("HTTP 404");
    }

    function handleCompileLogApiUnavailable() {
        if (state.compileLogs.apiUnavailable) {
            return;
        }

        state.compileLogs.apiUnavailable = true;
        state.compileLogs.polling = false;
        if (state.compileLogs.timerId) {
            window.clearTimeout(state.compileLogs.timerId);
            state.compileLogs.timerId = null;
        }

        if (!state.compileLogs.receivedAny) {
            setCompileLogText("リアルタイムのコンパイルログを取得できないため、生成完了後のログを表示します。\n");
        }
    }

    async function safeFlushCompileLogs() {
        try {
            await flushCompileLogs();
        } catch (error) {
            if (isCompileLogApiUnavailableError(error)) {
                handleCompileLogApiUnavailable();
                return false;
            }
            if (!isServerUnavailableError(error)) {
                console.error(error);
            }
            return false;
        }
        return true;
    }

    function buildCompileLogFallbackText(results) {
        const normalizedResults = Array.isArray(results) ? results : [];
        const blocks = normalizedResults.map((item, index) => {
            const logText = normalizeCompileLogText(item && item.compile_log);
            if (!logText.trim()) {
                return "";
            }

            if (normalizedResults.length === 1) {
                return logText;
            }

            const label = String(
                (item && (item.source || item.tex_file || item.pdf_file)) || `result ${index + 1}`
            );
            return `===== ${label} =====\n${logText}`;
        }).filter(Boolean);

        return blocks.join("\n\n");
    }

    function renderCompileLogFallback(results) {
        const fallbackText = buildCompileLogFallbackText(results);
        if (!fallbackText) {
            return;
        }
        if (state.compileLogs.receivedAny && !state.compileLogs.apiUnavailable) {
            return;
        }
        setCompileLogText(fallbackText);
        state.compileLogs.receivedAny = true;
    }

    async function flushCompileLogs() {
        const payload = await fetchJson(`/api/compile-logs?client_id=${encodeURIComponent(CLIENT_ID)}&after=${state.compileLogs.lastSeq}`);
        state.compileLogs.apiUnavailable = false;
        const lines = Array.isArray(payload.lines) ? payload.lines : [];
        lines.forEach((entry) => {
            appendCompileLogLine(entry.line || "");
        });
        state.compileLogs.lastSeq = Number(payload.last_seq || state.compileLogs.lastSeq || 0);
    }

    async function pollCompileLogs() {
        if (!state.compileLogs.polling) {
            return;
        }

        try {
            await safeFlushCompileLogs();
        } finally {
            if (state.compileLogs.polling) {
                state.compileLogs.timerId = window.setTimeout(pollCompileLogs, COMPILE_LOG_POLL_INTERVAL_MS);
            }
        }
    }

    function startCompileLogPolling() {
        state.compileLogs.polling = true;
        state.compileLogs.lastSeq = 0;
        state.compileLogs.receivedAny = false;
        state.compileLogs.apiUnavailable = false;
        if (state.compileLogs.timerId) {
            window.clearTimeout(state.compileLogs.timerId);
        }
        const terminal = byId("compileLogTerminal");
        const container = byId("compileLogContainer");
        if (terminal) {
            terminal.textContent = "";
        }
        if (container) {
            container.style.display = "block";
        }
        pollCompileLogs().catch((error) => console.error(error));
    }

    function stopCompileLogPolling() {
        state.compileLogs.polling = false;
        if (state.compileLogs.timerId) {
            window.clearTimeout(state.compileLogs.timerId);
            state.compileLogs.timerId = null;
        }
    }

    function setGenerationBusy(isBusy, loadingLabel) {
        state.isGenerating = isBusy;
        ["generateBtn", "generateAllBtn", "cleanupBtn", "resetSettingsBtn", "restartServerBtn", "stopServerBtn"]
            .forEach((id) => {
                const el = byId(id);
                if (el) {
                    el.disabled = isBusy;
                }
            });

        if (isBusy) {
            byId("loadingText").textContent = loadingLabel || "生成中...";
            byId("loading").style.display = "block";
            setProgressLabel("生成中");
        } else {
            byId("loading").style.display = "none";
            updateSelectionSummary();
        }
    }

    async function fetchJson(url, options) {
        let resp;
        try {
            resp = await fetch(url, options);
        } catch (_networkErr) {
            throw new Error(SERVER_UNREACHABLE_MESSAGE);
        }
        const text = await resp.text();
        let payload = {};
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (_parseErr) {
                if (!resp.ok) {
                    const httpError = new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
                    httpError.status = resp.status;
                    httpError.payload = payload;
                    throw httpError;
                }
                throw new Error("サーバーからJSON形式のレスポンスを取得できませんでした。");
            }
        }

        if (!resp.ok) {
            const message = payload.error || payload.message || `HTTP ${resp.status}`;
            const httpError = new Error(message);
            httpError.status = resp.status;
            httpError.payload = payload;
            throw httpError;
        }
        return payload;
    }

    function isServerUnavailableError(error) {
        const message = String((error && error.message) || error || "");
        return message.includes(SERVER_UNREACHABLE_MESSAGE);
    }

    function normalizeHexColor(value, fallback) {
        const raw = String(value || "").trim().toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(raw)) {
            return raw;
        }
        return fallback;
    }

    function normalizeFontSize(value, fallback) {
        const fallbackNumber = Number.isFinite(Number(fallback)) && Number(fallback) > 0
            ? Number(fallback)
            : 13.5;
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return fallbackNumber;
        }
        return Math.round(numeric * 10) / 10;
    }

    function formatFontSize(value) {
        const normalized = normalizeFontSize(value, 13.5);
        return Number.isInteger(normalized)
            ? String(normalized.toFixed(0))
            : normalized.toFixed(1).replace(/\.0$/, "");
    }

    function getDeviceFontSize(deviceKey) {
        const fallback = DEFAULT_DEVICE_FONT_SIZES[deviceKey] || 13.5;
        const device = state.devices[deviceKey] || {};
        return normalizeFontSize(device.font_size, fallback);
    }

    function syncFontSizeInput(deviceKey) {
        const input = byId("fontSizeInput");
        if (!input) {
            return;
        }
        input.value = formatFontSize(getDeviceFontSize(deviceKey || state.selectedDevice));
    }

    function updateSelectedDeviceFontSize(value) {
        const deviceKey = state.selectedDevice;
        const fallback = DEFAULT_DEVICE_FONT_SIZES[deviceKey] || 13.5;
        const normalized = normalizeFontSize(value, fallback);
        if (deviceKey && state.devices[deviceKey]) {
            state.devices[deviceKey].font_size = normalized;
        }
        const input = byId("fontSizeInput");
        if (input) {
            input.value = formatFontSize(normalized);
        }
        updateSizeReferencePreview();
        updateConfigSummary();
    }

    function updateColorPreview() {
        const preview = byId("colorPreview");
        const bg = byId("bgColorInput").value || DEFAULT_COLOR_PAIR.bg;
        const fg = byId("fgColorInput").value || DEFAULT_COLOR_PAIR.fg;
        preview.style.backgroundColor = bg;
        preview.style.color = fg;
        byId("colorMeta").textContent = `BG ${bg} / FG ${fg}`;
        state.selectedColor.bg = bg.toUpperCase();
        state.selectedColor.fg = fg.toUpperCase();
        updateSizeReferencePreview();
        updateConfigSummary();
    }

    function setSelectedFont(name) {
        const value = (name || "").trim();
        if (!value) return;
        state.selectedFont = value;

        const select = byId("fontFamilySelect");
        const hasOption = Array.from(select.options).some((opt) => opt.value === value);
        if (!hasOption) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = `${value} (現在値)`;
            select.appendChild(option);
        }
        select.value = value;
        byId("colorPreview").style.fontFamily = `"${value}", "${RECOMMENDED_FONT}", "Yu Mincho", "MS Mincho", serif`;
        updateSizeReferencePreview();
        updateConfigSummary();
    }

    function renderFontOptions() {
        const select = byId("fontFamilySelect");
        const meta = byId("fontMeta");
        const fonts = Array.isArray(state.availableFonts) ? state.availableFonts : [];

        select.innerHTML = "";

        if (fonts.length === 0) {
            const fallback = state.selectedFont || RECOMMENDED_FONT;
            const option = document.createElement("option");
            option.value = fallback;
            option.textContent = `${fallback} (現在値)`;
            select.appendChild(option);
            select.value = fallback;
            state.selectedFont = fallback;
            meta.textContent = "フォント一覧を取得できなかったため、現在値のみ利用します。";
            updateConfigSummary();
            return;
        }

        fonts.forEach((font) => {
            const option = document.createElement("option");
            option.value = font.name;
            let label = font.display_name;
            if (font.recommended) {
                label += " ★";
            }
            option.textContent = label;
            select.appendChild(option);
        });

        const hasSelected = Boolean(state.selectedFont)
            && fonts.some((font) => font.name === state.selectedFont);
        if (hasSelected) {
            setSelectedFont(state.selectedFont);
        } else {
            setSelectedFont(fonts[0].name);
        }

        const lualatexLabel = state.fontMetaInfo.lualatex_available
            ? "LuaLaTeX検出: OK"
            : "LuaLaTeX検出: NG";
        const refreshedLabel = state.fontMetaInfo.refreshed ? " / 一覧更新済み" : "";
        meta.textContent = `${fonts.length}件 ${lualatexLabel}${refreshedLabel}`;
        updateConfigSummary();
    }

    async function loadFonts(refresh) {
        const query = refresh ? "?refresh=1" : "";
        const payload = await fetchJson(`/api/lualatex-fonts${query}`);
        const fonts = Array.isArray(payload.fonts) ? payload.fonts : [];
        state.availableFonts = fonts;
        state.fontMetaInfo = {
            lualatex_available: Boolean(payload.lualatex_available),
            refreshed: Boolean(payload.refreshed),
        };
        renderFontOptions();
    }

    function isFrameAllowedDevice(device) {
        return ["pc", "tablet"].includes(device);
    }

    function isBodyColumnSelectableDevice(device) {
        return ["pc", "tablet"].includes(device);
    }

    function syncDeviceDependentDecorations() {
        const frameAllowed = isFrameAllowedDevice(state.selectedDevice);
        const bodyColumnSelectable = isBodyColumnSelectableDevice(state.selectedDevice);
        const orientationSelectable = deviceSupportsOrientation(state.selectedDevice);
        const imageMode = getBackgroundRenderMode() === "image";
        const coverAssets = state.backgroundAssets && Array.isArray(state.backgroundAssets.cover)
            ? state.backgroundAssets.cover
            : [];
        const washiAssets = state.backgroundAssets && Array.isArray(state.backgroundAssets.washi)
            ? state.backgroundAssets.washi
            : [];
        const mainWashiCheck = byId("mainWashiEnabled");
        const coverCheck = byId("coverTextureEnabled");
        const frameCheck = byId("mainFrameEnabled");
        const frameVariant = byId("mainFrameVariant");
        const pageNumberCheck = byId("pageNumberEnabled");
        const bodyColumnModeSingle = byId("bodyColumnModeSingle");
        const bodyColumnModeTwo = byId("bodyColumnModeTwo");
        const orientationWrap = byId("deviceOrientationWrap");
        const orientationPortrait = byId("deviceOrientationPortrait");
        const orientationLandscape = byId("deviceOrientationLandscape");
        const imageBackgroundOptions = byId("imageBackgroundOptions");
        const coverVariant = byId("coverTextureVariant");
        const coverImagePath = byId("coverImagePath");
        const coverImageOpacity = byId("coverImageOpacity");
        const washiImagePath = byId("washiImagePath");
        const washiImageOpacity = byId("washiImageOpacity");

        frameCheck.disabled = !frameAllowed;
        frameVariant.disabled = !frameAllowed || !frameCheck.checked;
        if (!frameAllowed) {
            frameCheck.checked = false;
        }

        if (pageNumberCheck) {
            pageNumberCheck.disabled = !frameAllowed;
            if (!frameAllowed) {
                pageNumberCheck.checked = false;
            }
        }

        if (bodyColumnModeSingle && bodyColumnModeTwo) {
            bodyColumnModeSingle.disabled = !bodyColumnSelectable;
            bodyColumnModeTwo.disabled = !bodyColumnSelectable;
            if (!bodyColumnSelectable) {
                setBodyColumnMode("single_column");
            }
        }

        if (orientationWrap && orientationPortrait && orientationLandscape) {
            orientationWrap.style.display = orientationSelectable ? "block" : "none";
            orientationPortrait.disabled = !orientationSelectable;
            orientationLandscape.disabled = !orientationSelectable;
            if (!orientationSelectable) {
                setDeviceOrientation("portrait");
            }
        }

        if (imageBackgroundOptions) {
            imageBackgroundOptions.style.display = imageMode ? "block" : "none";
        }

        if (coverVariant && coverCheck) {
            coverVariant.disabled = imageMode || !coverCheck.checked;
        }

        if (coverImagePath && coverCheck) {
            coverImagePath.disabled = !imageMode || !coverCheck.checked || coverAssets.length === 0;
        }

        if (coverImageOpacity && coverCheck) {
            coverImageOpacity.disabled = !imageMode || !coverCheck.checked;
        }

        if (washiImagePath && mainWashiCheck) {
            washiImagePath.disabled = !imageMode || !mainWashiCheck.checked || washiAssets.length === 0;
        }

        if (washiImageOpacity && mainWashiCheck) {
            washiImageOpacity.disabled = !imageMode || !mainWashiCheck.checked;
        }
    }

    function getBodyColumnMode() {
        const checked = document.querySelector("input[name='bodyColumnMode']:checked");
        return checked && checked.value === "two_column" ? "two_column" : "single_column";
    }

    function setBodyColumnMode(mode) {
        const normalized = mode === "two_column" ? "two_column" : "single_column";
        const radio = document.querySelector(`input[name='bodyColumnMode'][value='${normalized}']`);
        if (radio) {
            radio.checked = true;
        }
    }

    function getDecorationPayload() {
        const payload = {
            main_washi_enabled: byId("mainWashiEnabled").checked,
            main_frame_enabled: byId("mainFrameEnabled").checked,
            main_frame_variant: Number(byId("mainFrameVariant").value || 1),
            cover_texture_enabled: byId("coverTextureEnabled").checked,
            cover_texture_variant: Number(byId("coverTextureVariant").value || 1),
            background_render_mode: getBackgroundRenderMode(),
            cover_image_path: getSelectedBackgroundAssetPath("cover"),
            cover_image_opacity: Number(byId("coverImageOpacity").value || 0.92),
            washi_image_path: getSelectedBackgroundAssetPath("washi"),
            washi_image_opacity: Number(byId("washiImageOpacity").value || 0.18),
            body_column_mode: getBodyColumnMode(),
            device_orientation: getDeviceOrientation(),
        };
        const pageNumberCheck = byId("pageNumberEnabled");
        if (pageNumberCheck) {
            payload.page_number_enabled = pageNumberCheck.checked;
        }
        return payload;
    }

    function applyDecorationSettings(globalSettings, deviceSettings) {
        byId("mainWashiEnabled").checked = Boolean(globalSettings.main_washi_enabled ?? false);
        byId("mainFrameEnabled").checked = Boolean(globalSettings.main_frame_enabled ?? false);
        byId("mainFrameVariant").value = String(globalSettings.main_frame_variant || 1);
        byId("coverTextureEnabled").checked = Boolean(globalSettings.cover_texture_enabled ?? false);
        byId("coverTextureVariant").value = String(globalSettings.cover_texture_variant || 1);
        setBackgroundRenderMode(globalSettings.background_render_mode || "tikz");
        const coverImagePath = String(
            globalSettings.cover_image_path
            || (state.backgroundAssets.defaults && state.backgroundAssets.defaults.cover)
            || ""
        );
        const washiImagePath = String(
            globalSettings.washi_image_path
            || (state.backgroundAssets.defaults && state.backgroundAssets.defaults.washi)
            || ""
        );
        if (byId("coverImagePath")) {
            byId("coverImagePath").value = coverImagePath;
        }
        if (byId("washiImagePath")) {
            byId("washiImagePath").value = washiImagePath;
        }
        byId("coverImageOpacity").value = formatOpacityValue(globalSettings.cover_image_opacity, 0.92);
        byId("washiImageOpacity").value = formatOpacityValue(globalSettings.washi_image_opacity, 0.18);
        updateOpacityValueLabel("coverImageOpacity", "coverImageOpacityValue", 0.92);
        updateOpacityValueLabel("washiImageOpacity", "washiImageOpacityValue", 0.18);
        const fallbackMode = globalSettings.body_column_mode;
        const deviceMode = deviceSettings && deviceSettings.mode;
        setBodyColumnMode(deviceMode || fallbackMode);
        const deviceOrientation = deviceSettings && deviceSettings.orientation;
        if (deviceOrientation) {
            setDeviceOrientation(deviceOrientation);
        }
        const pageNumberCheck = byId("pageNumberEnabled");
        if (pageNumberCheck) {
            pageNumberCheck.checked = Boolean(globalSettings.page_number_enabled ?? true);
        }
    }

    function getFilteredAndSortedSources() {
        const search = (byId("sourceSearch").value || "").trim().toLowerCase();
        const sort = byId("sourceSort").value || "name-asc";

        const filtered = state.sourceFiles.filter((file) =>
            file.name.toLowerCase().includes(search)
        );

        filtered.sort((a, b) => {
            if (sort === "name-asc") return a.name.localeCompare(b.name, "ja");
            if (sort === "name-desc") return b.name.localeCompare(a.name, "ja");
            if (sort === "id-asc")
                return parseSourceId(a.name) - parseSourceId(b.name) || a.name.localeCompare(b.name, "ja");
            if (sort === "id-desc")
                return parseSourceId(b.name) - parseSourceId(a.name) || b.name.localeCompare(a.name, "ja");
            return 0;
        });

        return filtered;
    }

    function renderSources() {
        const filtered = getFilteredAndSortedSources();
        const currentSingle = byId("sourceFile").value || "";
        const checked = new Set(
            Array.from(document.querySelectorAll(".source-check:checked")).map((cb) => cb.value)
        );

        const select = byId("sourceFile");
        select.innerHTML = '<option value="">-- ファイルを選択 --</option>';
        filtered.forEach((file) => {
            const option = document.createElement("option");
            option.value = file.path;
            option.textContent = file.name;
            if (file.path === currentSingle) option.selected = true;
            select.appendChild(option);
        });

        const list = byId("sourceList");
        list.innerHTML = "";
        filtered.forEach((file, index) => {
            const item = document.createElement("label");
            const sourceId = parseSourceId(file.name);
            const checkboxId = `source_check_${index}`;
            const sourceIdLabel = sourceId === Number.MAX_SAFE_INTEGER ? "-" : sourceId;
            item.className = "list-group-item d-flex align-items-start gap-3 px-3 py-3";
            item.setAttribute("for", checkboxId);
            item.innerHTML = `
                <input type="checkbox" class="source-check form-check-input flex-shrink-0 mt-1" value="${escapeHtml(file.path)}" id="${checkboxId}">
                <span class="flex-grow-1">
                    <span class="d-block fw-semibold text-break">${escapeHtml(file.name)}</span>
                    <span class="d-block small text-secondary">作品ID: ${sourceIdLabel}</span>
                </span>
            `;
            const checkbox = item.querySelector("input");
            checkbox.checked = checked.has(file.path);
            item.classList.toggle("active", checkbox.checked);
            checkbox.addEventListener("change", () => {
                item.classList.toggle("active", checkbox.checked);
                updateProgress(22);
                updateSelectionSummary();
            });
            list.appendChild(item);
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="list-group-item px-3 py-4 text-center text-secondary small">該当するファイルがありません。</div>';
        }

        byId("sourceSummary").textContent = `${filtered.length} 件表示 / 全 ${state.sourceFiles.length} 件 / 選択 ${getSelectedSourceCount()} 件`;
        updateSelectionSummary();
    }

    function selectAllSources(checked) {
        document.querySelectorAll(".source-check").forEach((cb) => {
            cb.checked = checked;
            const row = cb.closest(".list-group-item");
            if (row) {
                row.classList.toggle("active", checked);
            }
        });
        updateProgress(22);
        updateSelectionSummary();
    }

    function getSelectedSources(forceAll) {
        const all = Array.from(document.querySelectorAll(".source-check"))
            .map((cb) => cb.value)
            .filter(Boolean);
        if (forceAll) return Array.from(new Set(all));

        const selected = Array.from(document.querySelectorAll(".source-check:checked"))
            .map((cb) => cb.value)
            .filter(Boolean);
        if (selected.length > 0) return Array.from(new Set(selected));

        const single = byId("sourceFile").value;
        return single ? [single] : [];
    }

    function applySelectedDeviceCard(selectedKey) {
        document.querySelectorAll("#deviceGrid .studio-device-card").forEach((card) => {
            card.classList.toggle("is-selected", card.dataset.deviceKey === selectedKey);
        });
    }

    function selectDevice(deviceKey, progressValue) {
        state.selectedDevice = deviceKey;
        const info = state.devices[deviceKey];
        if (info) {
            setDeviceOrientation(info.orientation || "portrait");
            if (info.mode) {
                setBodyColumnMode(info.mode);
            }
        }
        syncFontSizeInput(deviceKey);
        applySelectedDeviceCard(deviceKey);
        updateProgress(progressValue ?? 45);
        updateDevicePreview();
        syncDeviceDependentDecorations();
        updateConfigSummary();
    }

    function updateDevicePreview() {
        const info = state.devices[state.selectedDevice];
        if (!info) return;

        let width = Number(info.width || 0);
        let height = Number(info.height || 0);
        if (deviceSupportsOrientation(state.selectedDevice)) {
            const baseWidth = Number(info.base_width || width);
            const baseHeight = Number(info.base_height || height);
            if (getDeviceOrientation() === "landscape") {
                width = baseHeight;
                height = baseWidth;
            } else {
                width = baseWidth;
                height = baseHeight;
            }
        }

        byId("deviceMeta").textContent = `${width} x ${height} mm`;
        const box = byId("devicePreviewBox");
        const boxLabel = byId("deviceBoxLabel");
        const max = 180;
        const ratio = width / height;
        if (ratio >= 1) {
            box.style.width = `${max}px`;
            box.style.height = `${Math.max(40, Math.round(max / ratio))}px`;
        } else {
            box.style.height = `${max}px`;
            box.style.width = `${Math.max(40, Math.round(max * ratio))}px`;
        }
        if (boxLabel) {
            boxLabel.textContent = formatDeviceLabel(`${info.label} / ${width} x ${height} mm`);
        }
    }

    async function loadDevices() {
        const devices = await fetchJson("/api/devices");
        state.devices = devices;

        const grid = byId("deviceGrid");
        grid.innerHTML = "";
        Object.entries(devices).forEach(([key, device]) => {
            const baseWidth = Number(device.base_width || device.width || 0);
            const baseHeight = Number(device.base_height || device.height || 0);
            const supportsOrientation = Boolean(device.supports_orientation);
            const col = document.createElement("div");
            col.className = "col-sm-6 col-lg-4";
            const card = document.createElement("div");
            card.className = "card h-100 studio-device-card";
            card.dataset.deviceKey = key;
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.innerHTML = `
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <h6 class="card-title fw-bold text-dark mb-0">${escapeHtml(device.label)}</h6>
                        ${device.default ? '<span class="badge rounded-pill text-bg-light border text-dark">default</span>' : ""}
                    </div>
                    <p class="studio-device-meta mb-0">${baseWidth} x ${baseHeight} mm${supportsOrientation ? " / Portrait・Landscape対応" : ""}</p>
                </div>
            `;
            col.appendChild(card);
            card.addEventListener("click", () => selectDevice(key, 45));
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectDevice(key, 45);
                }
            });
            grid.appendChild(col);

            if (device.default && !state.selectedDevice) {
                state.selectedDevice = key;
            }
        });

        if (!state.selectedDevice) {
            state.selectedDevice = Object.keys(devices)[0];
        }
        const selectedDeviceData = devices[state.selectedDevice] || {};
        setDeviceOrientation(selectedDeviceData.orientation || "portrait");
        syncFontSizeInput(state.selectedDevice);
        applySelectedDeviceCard(state.selectedDevice);
        updateDevicePreview();
        syncDeviceDependentDecorations();
        updateConfigSummary();
    }

    async function loadSourceFiles() {
        const payload = await fetchJson("/api/data-files");
        const files = Array.isArray(payload.files) ? payload.files : [];
        state.sourceFiles = files;
    }

    async function loadBackgroundAssets() {
        const payload = await fetchJson("/api/background-assets");
        state.backgroundAssets = {
            cover: Array.isArray(payload.cover) ? payload.cover : [],
            washi: Array.isArray(payload.washi) ? payload.washi : [],
            defaults: payload.defaults && typeof payload.defaults === "object"
                ? payload.defaults
                : { cover: "", washi: "" },
        };
        renderBackgroundAssetSelect(
            "coverImagePath",
            state.backgroundAssets.cover,
            state.backgroundAssets.defaults.cover
        );
        renderBackgroundAssetSelect(
            "washiImagePath",
            state.backgroundAssets.washi,
            state.backgroundAssets.defaults.washi
        );
    }

    async function loadSettings() {
        const payload = await fetchJson("/api/settings");
        if (!payload.success) return;

        const settings = payload.settings || {};
        const globalSettings = settings.global || {};
        const allDeviceSettings = settings.devices || {};
        Object.entries(allDeviceSettings).forEach(([deviceKey, deviceSettings]) => {
            state.devices[deviceKey] = {
                ...(state.devices[deviceKey] || {}),
                ...(deviceSettings || {}),
            };
        });
        const selectedDeviceSettings = state.devices[state.selectedDevice] || {};
        if (globalSettings.font_family) {
            state.selectedFont = String(globalSettings.font_family);
        }
        byId("bgColorInput").value = normalizeHexColor(
            globalSettings.background_color,
            DEFAULT_COLOR_PAIR.bg
        );
        byId("fgColorInput").value = normalizeHexColor(
            globalSettings.text_color,
            DEFAULT_COLOR_PAIR.fg
        );
        applyDecorationSettings(globalSettings, selectedDeviceSettings);
        syncFontSizeInput(state.selectedDevice);
        syncDeviceDependentDecorations();
        updateColorPreview();
        setSelectedFont(state.selectedFont);
        updateConfigSummary();
    }

    async function loadColors() {
        byId("bgColorInput").value = normalizeHexColor(
            byId("bgColorInput").value,
            DEFAULT_COLOR_PAIR.bg
        );
        byId("fgColorInput").value = normalizeHexColor(
            byId("fgColorInput").value,
            DEFAULT_COLOR_PAIR.fg
        );
        state.selectedColor = {
            name: "custom",
            bg: byId("bgColorInput").value.toUpperCase(),
            fg: byId("fgColorInput").value.toUpperCase(),
        };
        updateColorPreview();
    }

    function applySampleColorScheme(scheme) {
        if (!scheme || typeof scheme !== "object") return;

        const bg = normalizeHexColor(scheme.bg, DEFAULT_COLOR_PAIR.bg);
        const fg = normalizeHexColor(scheme.fg, DEFAULT_COLOR_PAIR.fg);
        byId("bgColorInput").value = bg;
        byId("fgColorInput").value = fg;
        state.selectedColor.name = String(scheme.name || "sample");
        updateColorPreview();
    }

    function renderColorSamples() {
        const grid = byId("colorSampleGrid");
        if (!grid) return;
        const samples = Array.isArray(state.colorSamples) ? state.colorSamples.slice(0, 9) : [];
        grid.innerHTML = "";

        if (samples.length === 0) {
            grid.innerHTML = '<div class="col-12"><div class="small text-secondary">色見本を読み込めませんでした。</div></div>';
            return;
        }

        samples.forEach((scheme) => {
            const col = document.createElement("div");
            col.className = "col-sm-6 col-lg-4";
            const card = document.createElement("button");
            card.type = "button";
            card.className = "color-swatch-card w-100 text-start";
            card.style.backgroundColor = scheme.bg;
            card.style.color = scheme.fg;
            card.innerHTML = `
                <div class="color-swatch-title">${escapeHtml(String(scheme.name || "Scheme"))}</div>
                <div class="color-swatch-meta">${escapeHtml(String(scheme.bg || ""))} / ${escapeHtml(String(scheme.fg || ""))}</div>
                <div class="color-swatch-sample">春はあけぼの。</div>
            `;
            card.addEventListener("click", () => {
                applySampleColorScheme(scheme);
                updateProgress(60);
            });
            col.appendChild(card);
            grid.appendChild(col);
        });
    }

    async function loadColorSamples() {
        const payload = await fetchJson("/api/colors?mode=all&limit=9");
        const raw = Array.isArray(payload.schemes) ? payload.schemes : [];
        state.colorSamples = raw.slice(0, 9);
        renderColorSamples();
    }

    function renderSizeReferenceSample() {
        const panel = byId("sizeReferenceText");
        if (!panel) return;
        panel.value = SIZE_REFERENCE_SAMPLE;
        updateSizeReferencePreview();
    }

    function updateSizeReferencePreview() {
        const panel = byId("sizeReferenceText");
        if (!panel) return;

        const bg = (byId("bgColorInput") && byId("bgColorInput").value) || "#FFFFFF";
        const fg = (byId("fgColorInput") && byId("fgColorInput").value) || "#000000";
        const fontSize = getDeviceFontSize(state.selectedDevice);

        panel.style.backgroundColor = bg;
        panel.style.color = fg;
        panel.style.fontFamily = `"${state.selectedFont || RECOMMENDED_FONT}", "${RECOMMENDED_FONT}", "Yu Mincho", "MS Mincho", serif`;
        panel.style.fontSize = `${formatFontSize(fontSize)}pt`;

        const meta = byId("sizeReferenceMeta");
        if (meta) {
            meta.textContent = `BG ${bg.toUpperCase()} / FG ${fg.toUpperCase()}`;
        }
    }

    function showServerUnavailableAlertOnce() {
        Swal.fire({ icon: 'error', title: '通信エラー', text: SERVER_UNREACHABLE_MESSAGE });
    }

    async function waitForServerReady(timeoutMs = 25000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const response = await fetch("/health", { cache: "no-store" });
                if (response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    if (payload && payload.status === "ok") {
                        return true;
                    }
                }
            } catch (_err) {
                // server restart中は接続失敗が正常系なので握りつぶす
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        return false;
    }

    async function controlServer(action) {
        const isRestart = action === "restart";
        const confirmMessage = isRestart
            ? "serverを再起動します。よろしいですか？"
            : "serverを停止します。よろしいですか？";
        const confirmResult = await Swal.fire({
            title: '確認',
            text: confirmMessage,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'はい',
            cancelButtonText: 'キャンセル'
        });
        if (!confirmResult.isConfirmed) {
            return;
        }

        const payload = await fetchJson("/api/server/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
        });

        const result = byId("result");
        result.className = "alert alert-success mt-3 shadow-sm mb-0";
        result.innerHTML = `<h4 class="alert-heading h5 fw-bold">server操作</h4><p class="mb-0">${escapeHtml(payload.message || "操作を受け付けました。")}</p>`;
        result.style.display = "block";

        if (isRestart) {
            const back = await waitForServerReady(25000);
            if (back) {
                Swal.fire({ icon: 'success', title: '再起動完了', text: "serverが再起動しました" });
            } else {
                Swal.fire({ icon: 'info', title: '再起動中', text: "server再起動中です。反応がない場合は数秒後に再読み込みしてください。" });
            }
            return;
        }

        Swal.fire({ icon: 'success', title: '停止', text: "serverを停止しました" });
    }

    function buildSettingsSavePayload() {
        if (!state.selectedDevice) {
            throw new Error("デバイスを選択してください");
        }

        const bg = normalizeHexColor(byId("bgColorInput").value, DEFAULT_COLOR_PAIR.bg);
        const fg = normalizeHexColor(byId("fgColorInput").value, DEFAULT_COLOR_PAIR.fg);
        const decorations = getDecorationPayload();
        const {
            body_column_mode: bodyColumnMode,
            device_orientation: deviceOrientation,
            ...globalDecorations
        } = decorations;

        return {
            global: {
                font_family: state.selectedFont,
                background_color: bg,
                text_color: fg,
                ...globalDecorations,
            },
            devices: {
                [state.selectedDevice]: {
                    font_size: getDeviceFontSize(state.selectedDevice),
                    mode: bodyColumnMode,
                    orientation: deviceOrientation,
                },
            },
        };
    }

    function syncSavedDeviceState(settings) {
        const allDeviceSettings = settings && settings.devices && typeof settings.devices === "object"
            ? settings.devices
            : {};
        const savedDevice = allDeviceSettings[state.selectedDevice] || {};
        const currentDevice = state.devices[state.selectedDevice];
        if (currentDevice && savedDevice) {
            if (savedDevice.font_size) {
                currentDevice.font_size = normalizeFontSize(
                    savedDevice.font_size,
                    DEFAULT_DEVICE_FONT_SIZES[state.selectedDevice] || 13.5
                );
            }
            if (savedDevice.mode) {
                currentDevice.mode = savedDevice.mode;
            }
            if (savedDevice.orientation) {
                currentDevice.orientation = savedDevice.orientation;
            }
        }
        syncFontSizeInput(state.selectedDevice);
    }

    async function saveCurrentStudioSettings(options = {}) {
        const showFeedback = options.showFeedback !== false;
        const payload = buildSettingsSavePayload();

        const data = await fetchJson("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (data.success) {
            syncSavedDeviceState(data.settings || {});
            if (showFeedback) {
                const result = byId("result");
                result.className = "alert alert-success mt-3 shadow-sm mb-0";
                result.innerHTML = "<h4 class=\"alert-heading h5 fw-bold\">設定保存 完了</h4><p class=\"mb-0\">配色・表紙/和紙・段組・向きを含む現在の設定をカスタム設定へ保存しました。</p>";
                result.style.display = "block";
            }
            return data;
        } else {
            throw new Error(data.error || "save failed");
        }
    }

    async function saveColorSettings() {
        try {
            await saveCurrentStudioSettings({ showFeedback: true });
        } catch (error) {
            if (String((error && error.message) || "").includes("デバイスを選択してください")) {
                Swal.fire({ icon: 'warning', title: '警告', text: error.message });
                return;
            }
            throw error;
        }
    }

    function renderGenerationResults(results, forceAll) {
        const resultDiv = byId("result");
        const normalizedResults = Array.isArray(results) ? results : [];
        const failures = normalizedResults.filter((item) => !item.success);
        const successes = normalizedResults.filter((item) => item.success);

        if (normalizedResults.length === 1 && !forceAll) {
            const item = normalizedResults[0];
            if (item.success) {
                resultDiv.className = "alert alert-success mt-3 shadow-sm mb-0";
                resultDiv.innerHTML = `
                    <h4 class="alert-heading h5 fw-bold">生成成功</h4>
                    <p class="mb-1">TEX: <code>${escapeHtml(item.tex_file || "")}</code></p>
                    ${item.pdf_url ? `<p class="mb-0"><a href="${item.pdf_url}" target="_blank" rel="noopener noreferrer" class="alert-link">PDFを開く</a></p>` : ""}
                `;
                Swal.fire({ icon: 'success', title: '成功', text: "生成できました", timer: 2200, showConfirmButton: false });
            } else {
                resultDiv.className = "alert alert-danger mt-3 shadow-sm mb-0";
                resultDiv.innerHTML = `<h4 class="alert-heading h5 fw-bold">生成失敗</h4><p class="mb-0">${escapeHtml(item.error || "unknown error")}</p>`;
            }
            resultDiv.style.display = "block";
            return;
        }

        const successLinks = successes
            .filter((item) => item.pdf_url)
            .slice(0, 12)
            .map((item) => `<li><a href="${item.pdf_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source || "(source unknown)")}</a></li>`)
            .join("");
        const remainingSuccessCount = Math.max(0, successes.filter((item) => item.pdf_url).length - 12);
        const errors = failures
            .slice(0, 12)
            .map((item) => `<li>${escapeHtml(item.source || "(source unknown)")}: ${escapeHtml(item.error || "unknown error")}</li>`)
            .join("");
        const remainingErrorCount = Math.max(0, failures.length - 12);

        resultDiv.className = failures.length === 0
            ? "alert alert-success mt-3 shadow-sm mb-0"
            : "alert alert-danger mt-3 shadow-sm mb-0";
        resultDiv.innerHTML = `
            <h4 class="alert-heading h5 fw-bold">${failures.length === 0 ? "一括生成 完了" : "一括生成 完了（一部失敗）"}</h4>
            <p class="mb-2">成功 ${successes.length} / ${normalizedResults.length}</p>
            ${successLinks ? `<ul class="mb-2">${successLinks}</ul>` : '<p class="mb-2">PDFリンクはありません。</p>'}
            ${remainingSuccessCount > 0 ? `<p class="small mb-2 text-muted">ほか ${remainingSuccessCount} 件の成功結果があります。</p>` : ""}
            ${errors ? `<hr><h5 class="h6 fw-bold">失敗一覧</h5><ul class="mb-0">${errors}</ul>` : ""}
            ${remainingErrorCount > 0 ? `<p class="small mt-2 mb-0 text-muted">ほか ${remainingErrorCount} 件の失敗があります。</p>` : ""}
        `;
        resultDiv.style.display = "block";
        if (failures.length === 0) {
            Swal.fire({ icon: 'success', title: '成功', text: "生成できました", timer: 2200, showConfirmButton: false });
        }
    }

    async function generate(forceAll) {
        const selectedSources = forceAll ? [] : getSelectedSources(false);
        if (!forceAll && selectedSources.length === 0) {
            Swal.fire({ icon: 'warning', title: '警告', text: "ファイルを選択してください" });
            return;
        }
        if (!state.selectedDevice) {
            Swal.fire({ icon: 'warning', title: '警告', text: "デバイスを選択してください" });
            return;
        }

        const bg = normalizeHexColor(byId("bgColorInput").value, DEFAULT_COLOR_PAIR.bg);
        const fg = normalizeHexColor(byId("fgColorInput").value, DEFAULT_COLOR_PAIR.fg);
        const resultDiv = byId("result");
        resultDiv.style.display = "none";

        const payloadBase = {
            device: state.selectedDevice,
            font: state.selectedFont,
            bg_color: bg,
            fg_color: fg,
            compile_pdf: true,
            client_id: CLIENT_ID,
            ...getDecorationPayload(),
        };

        try {
            const loadingLabel = forceAll
                ? "data 全件を生成中..."
                : `選択した ${selectedSources.length} 件を生成中...`;
            setGenerationBusy(true, loadingLabel);
            updateProgress(0, "設定を保存中");
            await saveCurrentStudioSettings({ showFeedback: false });
            updateProgress(8, "生成開始");
            startCompileLogPolling();

            const data = await fetchJson("/api/generate-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...payloadBase,
                    sources: selectedSources,
                    generate_all: forceAll,
                }),
            });

            await safeFlushCompileLogs();
            const results = Array.isArray(data.results) ? data.results : [];
            renderCompileLogFallback(results);
            const failures = results.filter((item) => !item.success).length;
            updateProgress(100, failures === 0 ? "生成完了" : "一部失敗");
            renderGenerationResults(results, forceAll);
        } catch (err) {
            await safeFlushCompileLogs();
            renderCompileLogFallback(err && err.payload && err.payload.results);
            if (isServerUnavailableError(err)) {
                showServerUnavailableAlertOnce();
            }

            resultDiv.className = "alert alert-danger mt-3 shadow-sm mb-0";
            resultDiv.innerHTML = `<h4 class="alert-heading h5 fw-bold">生成失敗</h4><p class="mb-0">${escapeHtml(String(err && err.message ? err.message : err))}</p>`;
            resultDiv.style.display = "block";
            updateProgress(100, "生成失敗");
        } finally {
            stopCompileLogPolling();
            setGenerationBusy(false);
        }
    }

    async function cleanupNonPdf() {
        const data = await fetchJson("/api/session/cleanup-nonpdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        });
        const result = byId("result");
        if (data.success) {
            result.className = "alert alert-success mt-3 shadow-sm mb-0";
            result.innerHTML = `<h4 class="alert-heading h5 fw-bold">クリーンアップ完了</h4><p class="mb-0">削除件数: ${data.deleted_files}</p>`;
        } else {
            result.className = "alert alert-danger mt-3 shadow-sm mb-0";
            result.innerHTML = `<h4 class="alert-heading h5 fw-bold">クリーンアップ失敗</h4><p class="mb-0">${escapeHtml(data.error || "unknown")}</p>`;
        }
        result.style.display = "block";
    }

    async function resetSettingsToDefault() {
        const confirmResult = await Swal.fire({
            title: '確認',
            text: "保存済みのカスタム設定を削除して、デフォルト設定へ戻します。よろしいですか？",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'はい',
            cancelButtonText: 'キャンセル'
        });
        if (!confirmResult.isConfirmed) return;

        const data = await fetchJson("/api/settings/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        });
        if (!data.success) {
            throw new Error(data.error || "設定の初期化に失敗しました。");
        }

        await loadSettings();
        await loadFonts(false);
        await loadColors();
        updateProgress(52);

        const result = byId("result");
        result.className = "alert alert-success mt-3 shadow-sm mb-0";
        result.innerHTML =
            "<h4 class=\"alert-heading h5 fw-bold\">初期化 完了</h4><p class=\"mb-0\">設定をデフォルト値（推奨フォント含む）へ戻しました。</p>";
        result.style.display = "block";
    }

    function applyQueryColorPreset() {
        const q = new URLSearchParams(window.location.search);
        const bg = q.get("bg");
        const fg = q.get("fg");
        const font = q.get("font");
        if (bg) byId("bgColorInput").value = bg;
        if (fg) byId("fgColorInput").value = fg;
        if (font) setSelectedFont(font);

        byId("bgColorInput").value = normalizeHexColor(
            byId("bgColorInput").value,
            DEFAULT_COLOR_PAIR.bg
        );
        byId("fgColorInput").value = normalizeHexColor(
            byId("fgColorInput").value,
            DEFAULT_COLOR_PAIR.fg
        );
        updateColorPreview();
    }

    function applyCatalogColorPreset(scheme) {
        if (!scheme || typeof scheme !== "object") {
            return;
        }

        const bg = normalizeHexColor(scheme.bg, DEFAULT_COLOR_PAIR.bg);
        const fg = normalizeHexColor(scheme.fg, DEFAULT_COLOR_PAIR.fg);
        byId("bgColorInput").value = bg;
        byId("fgColorInput").value = fg;

        if (scheme.font) {
            setSelectedFont(String(scheme.font));
        }

        state.selectedColor.name = scheme.name ? String(scheme.name) : "catalog";
        updateColorPreview();
        loadColorSamples().catch((error) => console.error(error));
        updateProgress(60);
    }

    function bindColorCatalogBridge() {
        window.addEventListener("message", (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            const payload = event.data;
            if (!payload || typeof payload !== "object") {
                return;
            }
            if (payload.type !== COLOR_SCHEME_MESSAGE_TYPE) {
                return;
            }
            applyCatalogColorPreset(payload.scheme || {});
        });
    }

    async function init() {
        bindColorCatalogBridge();

        byId("sourceSearch").addEventListener("input", renderSources);
        byId("sourceSort").addEventListener("change", renderSources);
        byId("sourceFile").addEventListener("change", () => {
            updateProgress(22);
            updateSelectionSummary();
        });
        byId("selectAllBtn").addEventListener("click", () => selectAllSources(true));
        byId("clearAllBtn").addEventListener("click", () => selectAllSources(false));

        byId("bgColorInput").addEventListener("input", () => {
            updateColorPreview();
            state.selectedColor.name = "custom";
        });
        byId("fgColorInput").addEventListener("input", () => {
            updateColorPreview();
            state.selectedColor.name = "custom";
        });
        byId("saveColorBtn").addEventListener("click", () => saveColorSettings().catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message })));
        byId("fontFamilySelect").addEventListener("change", () => {
            setSelectedFont(byId("fontFamilySelect").value);
            updateProgress(72);
        });
        byId("fontSizeInput").addEventListener("input", () => {
            updateSelectedDeviceFontSize(byId("fontSizeInput").value);
        });
        byId("fontSizeInput").addEventListener("change", () => {
            updateSelectedDeviceFontSize(byId("fontSizeInput").value);
            updateProgress(72);
        });
        byId("refreshFontListBtn").addEventListener("click", () => {
            loadFonts(true).catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message }));
        });
        byId("generateBtn").addEventListener("click", () => generate(false));
        byId("generateAllBtn").addEventListener("click", () => generate(true));
        byId("cleanupBtn").addEventListener("click", () => cleanupNonPdf().catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message })));
        byId("resetSettingsBtn").addEventListener("click", () =>
            resetSettingsToDefault().catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message }))
        );
        byId("restartServerBtn").addEventListener("click", () =>
            controlServer("restart").catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message }))
        );
        byId("stopServerBtn").addEventListener("click", () =>
            controlServer("stop").catch((e) => Swal.fire({ icon: 'error', title: 'エラー', text: e.message }))
        );
        document.querySelectorAll("input[name='backgroundRenderMode']").forEach((radio) => {
            radio.addEventListener("change", () => {
                syncDeviceDependentDecorations();
                updateProgress(72);
            });
        });
        byId("mainWashiEnabled").addEventListener("change", (e) => {
            document.body.classList.toggle("washi-active", e.target.checked);
            syncDeviceDependentDecorations();
            updateProgress(72);
        });
        byId("mainFrameEnabled").addEventListener("change", () => {
            syncDeviceDependentDecorations();
            updateProgress(72);
        });
        byId("mainFrameVariant").addEventListener("change", () => updateProgress(72));
        byId("coverTextureEnabled").addEventListener("change", () => {
            syncDeviceDependentDecorations();
            updateProgress(72);
        });
        byId("coverTextureVariant").addEventListener("change", () => updateProgress(72));
        byId("coverImagePath").addEventListener("change", () => updateProgress(72));
        byId("washiImagePath").addEventListener("change", () => updateProgress(72));
        byId("coverImageOpacity").addEventListener("input", () => {
            updateOpacityValueLabel("coverImageOpacity", "coverImageOpacityValue", 0.92);
            updateProgress(72);
        });
        byId("washiImageOpacity").addEventListener("input", () => {
            updateOpacityValueLabel("washiImageOpacity", "washiImageOpacityValue", 0.18);
            updateProgress(72);
        });
        document.querySelectorAll("input[name='bodyColumnMode']").forEach((radio) => {
            radio.addEventListener("change", () => updateProgress(72));
        });
        document.querySelectorAll("input[name='deviceOrientation']").forEach((radio) => {
            radio.addEventListener("change", () => {
                state.deviceOrientation = getDeviceOrientation();
                if (state.selectedDevice === "tablet") {
                    if (state.deviceOrientation === "landscape" && getBodyColumnMode() !== "two_column") {
                        setBodyColumnMode("two_column");
                    }
                    if (state.deviceOrientation === "portrait" && getBodyColumnMode() === "two_column") {
                        setBodyColumnMode("single_column");
                    }
                }
                updateDevicePreview();
                updateConfigSummary();
                updateProgress(46);
            });
        });

        renderSizeReferenceSample();

        await loadSourceFiles();
        renderSources();
        await loadDevices();
        await loadBackgroundAssets();
        await loadSettings();
        await loadFonts(false);
        applyQueryColorPreset();
        await loadColors();
        await loadColorSamples();
        updateOpacityValueLabel("coverImageOpacity", "coverImageOpacityValue", 0.92);
        updateOpacityValueLabel("washiImageOpacity", "washiImageOpacityValue", 0.18);
        updateProgress(76);
        updateSelectionSummary();
        updateConfigSummary();

        if (byId("mainWashiEnabled").checked) {
            document.body.classList.add("washi-active");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'エラー', text: "初期化に失敗しました: " + error.message });
        });
    });
})();
