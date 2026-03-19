(function () {
    "use strict";

    // UI state is intentionally centralized so customization points are easy to track.
    const SUPPORTED_MODES = ["light", "dark", "intermediate"];
    const RECOMMENDED_FONT = "IPAmjMincho";
    const SERVER_UNREACHABLE_MESSAGE = "serverに接続できません";
    const MODE_DEFAULT_COLORS = {
        light: { bg: "#FFFFFF", fg: "#000000" },
        dark: { bg: "#000000", fg: "#FFFFFF" },
        intermediate: { bg: "#D3D3D3", fg: "#4F4F4F" },
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
        modeColors: {
            light: { ...MODE_DEFAULT_COLORS.light },
            dark: { ...MODE_DEFAULT_COLORS.dark },
            intermediate: { ...MODE_DEFAULT_COLORS.intermediate },
        },
        selectedColor: {
            name: "custom",
            bg: "#FFFFFF",
            fg: "#000000",
            mode: "light",
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

    function updateProgress(percent) {
        byId("progress").style.width = `${percent}%`;
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
                    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
                }
                throw new Error("サーバーからJSON形式のレスポンスを取得できませんでした。");
            }
        }

        if (!resp.ok) {
            const message = payload.error || payload.message || `HTTP ${resp.status}`;
            throw new Error(message);
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

    function getModeDefaults(mode) {
        const normalized = SUPPORTED_MODES.includes(mode) ? mode : "light";
        const saved = state.modeColors[normalized] || MODE_DEFAULT_COLORS[normalized];
        return {
            bg: normalizeHexColor(saved.bg, MODE_DEFAULT_COLORS[normalized].bg),
            fg: normalizeHexColor(saved.fg, MODE_DEFAULT_COLORS[normalized].fg),
        };
    }

    function applyModeStoredColors(mode) {
        const normalized = SUPPORTED_MODES.includes(mode) ? mode : "light";
        const colors = getModeDefaults(normalized);
        byId("bgColorInput").value = colors.bg;
        byId("fgColorInput").value = colors.fg;
        state.selectedColor.mode = normalized;
        state.selectedColor.name = "custom";
        updateColorPreview();
    }

    function getCurrentMode() {
        const checked = document.querySelector("input[name='colorMode']:checked");
        return checked ? checked.value : "light";
    }

    function setMode(mode) {
        const value = SUPPORTED_MODES.includes(mode) ? mode : "light";
        const radio = document.querySelector(`input[name='colorMode'][value='${value}']`);
        if (radio) radio.checked = true;
    }

    function updateColorPreview() {
        const preview = byId("colorPreview");
        const bg = byId("bgColorInput").value || "#FFFFFF";
        const fg = byId("fgColorInput").value || "#000000";
        preview.style.backgroundColor = bg;
        preview.style.color = fg;
        byId("colorMeta").textContent = `BG ${bg} / FG ${fg}`;
        state.selectedColor.bg = bg.toUpperCase();
        state.selectedColor.fg = fg.toUpperCase();

        const mode = getCurrentMode();
        state.modeColors[mode] = {
            bg: bg.toUpperCase(),
            fg: fg.toUpperCase(),
        };
        state.selectedColor.mode = mode;
        updateSizeReferencePreview();
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
    }

    async function loadFonts(refresh) {
        const query = refresh ? "?refresh=1" : "";
        const payload = await fetchJson(`/api/lualatex-fonts${query}`);
        const select = byId("fontFamilySelect");
        const meta = byId("fontMeta");
        const fonts = Array.isArray(payload.fonts) ? payload.fonts : [];

        select.innerHTML = "";
        if (fonts.length === 0) {
            const fallback = state.selectedFont || RECOMMENDED_FONT;
            const option = document.createElement("option");
            option.value = fallback;
            option.textContent = `${fallback} (固定)`;
            select.appendChild(option);
            select.value = fallback;
            state.selectedFont = fallback;
            meta.textContent = "フォント一覧を取得できなかったため、現在値のみ利用します。";
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

        if (state.selectedFont) {
            setSelectedFont(state.selectedFont);
        } else {
            setSelectedFont(fonts[0].name);
        }

        const lualatexLabel = payload.lualatex_available
            ? "LuaLaTeX検出: OK"
            : "LuaLaTeX検出: NG";
        const refreshedLabel = payload.refreshed ? " / 一覧更新済み" : "";
        meta.textContent = `${fonts.length}件 ${lualatexLabel}${refreshedLabel}`;
    }

    function isFrameAllowedDevice(device) {
        return ["pc", "ipad", "ipad_landscape"].includes(device);
    }

    function syncDeviceDependentDecorations() {
        const frameAllowed = isFrameAllowedDevice(state.selectedDevice);
        const frameCheck = byId("mainFrameEnabled");
        const frameVariant = byId("mainFrameVariant");
        frameCheck.disabled = !frameAllowed;
        frameVariant.disabled = !frameAllowed || !frameCheck.checked;
        if (!frameAllowed) frameCheck.checked = false;
    }

    function getDecorationPayload() {
        return {
            main_washi_enabled: byId("mainWashiEnabled").checked,
            main_frame_enabled: byId("mainFrameEnabled").checked,
            main_frame_variant: Number(byId("mainFrameVariant").value || 1),
            cover_texture_enabled: byId("coverTextureEnabled").checked,
            cover_texture_variant: Number(byId("coverTextureVariant").value || 1),
        };
    }

    function applyDecorationSettings(globalSettings) {
        byId("mainWashiEnabled").checked = Boolean(globalSettings.main_washi_enabled ?? false);
        byId("mainFrameEnabled").checked = Boolean(globalSettings.main_frame_enabled ?? false);
        byId("mainFrameVariant").value = String(globalSettings.main_frame_variant || 1);
        byId("coverTextureEnabled").checked = Boolean(globalSettings.cover_texture_enabled ?? false);
        byId("coverTextureVariant").value = String(globalSettings.cover_texture_variant || 1);
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
        filtered.forEach((file) => {
            const label = document.createElement("label");
            label.className = "source-item";
            label.innerHTML = `
                <input type="checkbox" class="source-check" value="${escapeHtml(file.path)}">
                <span>${escapeHtml(file.name)}</span>
            `;
            const checkbox = label.querySelector("input");
            checkbox.checked = checked.has(file.path);
            checkbox.addEventListener("change", () => updateProgress(22));
            list.appendChild(label);
        });

        byId("sourceSummary").textContent = `${filtered.length} 件表示 / 全 ${state.sourceFiles.length} 件`;
    }

    function selectAllSources(checked) {
        document.querySelectorAll(".source-check").forEach((cb) => {
            cb.checked = checked;
        });
        updateProgress(22);
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

    function updateDevicePreview() {
        const info = state.devices[state.selectedDevice];
        if (!info) return;

        byId("deviceMeta").textContent = `${info.width} x ${info.height} mm`;
        const box = byId("devicePreviewBox");
        const boxLabel = byId("deviceBoxLabel");
        const max = 180;
        const ratio = info.width / info.height;
        if (ratio >= 1) {
            box.style.width = `${max}px`;
            box.style.height = `${Math.max(40, Math.round(max / ratio))}px`;
        } else {
            box.style.height = `${max}px`;
            box.style.width = `${Math.max(40, Math.round(max * ratio))}px`;
        }
        if (boxLabel) {
            boxLabel.textContent = formatDeviceLabel(`${info.label} / ${info.width} x ${info.height} mm`);
        }
    }

    async function loadDevices() {
        const devices = await fetchJson("/api/devices");
        state.devices = devices;

        const grid = byId("deviceGrid");
        grid.innerHTML = "";
        Object.entries(devices).forEach(([key, device]) => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="card-label">${escapeHtml(device.label)}</div>
                <div class="card-desc">${device.width} x ${device.height} mm</div>
            `;
            card.addEventListener("click", () => {
                document.querySelectorAll("#deviceGrid .card").forEach((c) => c.classList.remove("active"));
                card.classList.add("active");
                state.selectedDevice = key;
                updateProgress(45);
                updateDevicePreview();
                syncDeviceDependentDecorations();
            });
            grid.appendChild(card);

            if (device.default && !state.selectedDevice) {
                state.selectedDevice = key;
                card.classList.add("active");
            }
        });

        if (!state.selectedDevice) {
            state.selectedDevice = Object.keys(devices)[0];
            const first = grid.querySelector(".card");
            if (first) first.classList.add("active");
        }
        updateDevicePreview();
        syncDeviceDependentDecorations();
    }

    async function loadSourceFiles() {
        const payload = await fetchJson("/api/data-files");
        const files = Array.isArray(payload.files) ? payload.files : [];
        state.sourceFiles = files;
    }

    async function loadSettings() {
        const payload = await fetchJson("/api/settings");
        if (!payload.success) return;

        const settings = payload.settings || {};
        const globalSettings = settings.global || {};
        setMode(globalSettings.color_mode || "light");
        if (globalSettings.font_family) {
            state.selectedFont = String(globalSettings.font_family);
        }

        SUPPORTED_MODES.forEach((mode) => {
            const bgKey = `background_color_${mode}`;
            const fgKey = `text_color_${mode}`;
            const defaults = MODE_DEFAULT_COLORS[mode];
            const bgRaw =
                globalSettings[bgKey] ||
                (globalSettings.color_mode === mode ? globalSettings.background_color : "");
            const fgRaw =
                globalSettings[fgKey] ||
                (globalSettings.color_mode === mode ? globalSettings.text_color : "");

            state.modeColors[mode] = {
                bg: normalizeHexColor(bgRaw, defaults.bg),
                fg: normalizeHexColor(fgRaw, defaults.fg),
            };
        });

        applyModeStoredColors(getCurrentMode());
        applyDecorationSettings(globalSettings);
        syncDeviceDependentDecorations();
        updateColorPreview();
        setSelectedFont(state.selectedFont);
    }

    async function loadColors() {
        const mode = getCurrentMode();
        const defaults = MODE_DEFAULT_COLORS[mode] || MODE_DEFAULT_COLORS.light;
        const modeDefaults = getModeDefaults(mode);
        byId("bgColorInput").value = normalizeHexColor(byId("bgColorInput").value, modeDefaults.bg);
        byId("fgColorInput").value = normalizeHexColor(byId("fgColorInput").value, modeDefaults.fg);
        state.selectedColor = {
            mode,
            name: "custom",
            bg: byId("bgColorInput").value.toUpperCase(),
            fg: byId("fgColorInput").value.toUpperCase(),
        };
        updateColorPreview();
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

        panel.style.backgroundColor = bg;
        panel.style.color = fg;
        panel.style.fontFamily = `"${state.selectedFont || RECOMMENDED_FONT}", "${RECOMMENDED_FONT}", "Yu Mincho", "MS Mincho", serif`;
        panel.style.fontSize = "13.5pt";

        const meta = byId("sizeReferenceMeta");
        if (meta) {
            meta.textContent = `BG ${bg.toUpperCase()} / FG ${fg.toUpperCase()}`;
        }
    }

    function showServerUnavailableAlertOnce() {
        alert(SERVER_UNREACHABLE_MESSAGE);
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
        if (!window.confirm(confirmMessage)) {
            return;
        }

        const payload = await fetchJson("/api/server/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
        });

        const result = byId("result");
        result.className = "result success";
        result.innerHTML = `<h3>server操作</h3><p>${escapeHtml(payload.message || "操作を受け付けました。")}</p>`;
        result.style.display = "block";

        if (isRestart) {
            const back = await waitForServerReady(25000);
            if (back) {
                alert("serverが再起動しました");
            } else {
                alert("server再起動中です。反応がない場合は数秒後に再読み込みしてください。");
            }
            return;
        }

        alert("serverを停止しました");
    }

    async function saveColorSettings() {
        if (!state.selectedDevice) {
            alert("デバイスを選択してください");
            return;
        }

        const mode = getCurrentMode();
        const defaults = MODE_DEFAULT_COLORS[mode] || MODE_DEFAULT_COLORS.light;
        const bg = normalizeHexColor(byId("bgColorInput").value, defaults.bg);
        const fg = normalizeHexColor(byId("fgColorInput").value, defaults.fg);

        const payload = {
            global: {
                color_mode: mode,
                font_family: state.selectedFont,
                background_color: bg,
                text_color: fg,
                ...getDecorationPayload(),
            },
            devices: {
                [state.selectedDevice]: {
                    color_mode: mode,
                },
            },
        };
        payload.global[`background_color_${mode}`] = bg;
        payload.global[`text_color_${mode}`] = fg;

        const data = await fetchJson("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (data.success) {
            state.modeColors[mode] = { bg, fg };
            const result = byId("result");
            result.className = "result success";
            result.innerHTML = "<h3>設定保存 完了</h3><p>背景色・文字色・装飾オプションをカスタム設定に保存しました。</p>";
            result.style.display = "block";
        } else {
            throw new Error(data.error || "save failed");
        }
    }

    async function generate(forceAll) {
        const selectedSources = getSelectedSources(forceAll);
        if (selectedSources.length === 0) {
            alert("ファイルを選択してください");
            return;
        }
        if (!state.selectedDevice) {
            alert("デバイスを選択してください");
            return;
        }

        const mode = getCurrentMode();
        const defaults = MODE_DEFAULT_COLORS[mode] || MODE_DEFAULT_COLORS.light;
        const bg = normalizeHexColor(byId("bgColorInput").value, defaults.bg);
        const fg = normalizeHexColor(byId("fgColorInput").value, defaults.fg);

        byId("loading").style.display = "block";
        const resultDiv = byId("result");
        resultDiv.style.display = "none";
        updateProgress(0);

        const payloadBase = {
            device: state.selectedDevice,
            font: state.selectedFont,
            mode,
            bg_color: bg,
            fg_color: fg,
            compile_pdf: true,
            ...getDecorationPayload(),
        };

        const results = [];
        let failures = 0;
        for (let i = 0; i < selectedSources.length; i += 1) {
            byId("loadingText").textContent = `生成中... ${i + 1}/${selectedSources.length}`;
            const source = selectedSources[i];
            try {
                const data = await fetchJson("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payloadBase, source }),
                });
                data.source = source;
                data.success = Boolean(data.success);
                results.push(data);
                if (!data.success) failures += 1;
            } catch (err) {
                if (isServerUnavailableError(err)) {
                    failures += 1;
                    results.push({ source, success: false, error: SERVER_UNREACHABLE_MESSAGE });
                    showServerUnavailableAlertOnce();
                    break;
                }
                failures += 1;
                results.push({ source, success: false, error: String(err) });
            }
            updateProgress(Math.round(((i + 1) / selectedSources.length) * 100));
        }

        byId("loading").style.display = "none";

        if (results.length === 1) {
            const item = results[0];
            if (item.success) {
                resultDiv.className = "result success";
                resultDiv.innerHTML = `
                    <h3>生成成功</h3>
                    <p>TEX: <code>${escapeHtml(item.tex_file || "")}</code></p>
                    ${item.pdf_url ? `<p><a href="${item.pdf_url}" target="_blank" rel="noopener noreferrer">PDFを開く</a></p>` : ""}
                `;
                alert("生成できました");
            } else {
                resultDiv.className = "result error";
                resultDiv.innerHTML = `<h3>生成失敗</h3><p>${escapeHtml(item.error || "unknown error")}</p>`;
            }
            resultDiv.style.display = "block";
            return;
        }

        const links = results
            .filter((r) => r.success && r.pdf_url)
            .map((r) => `<li><a href="${r.pdf_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.source)} の PDF</a></li>`)
            .join("");
        const errors = results
            .filter((r) => !r.success)
            .map((r) => `<li>${escapeHtml(r.source)}: ${escapeHtml(r.error || "unknown error")}</li>`)
            .join("");

        resultDiv.className = failures === 0 ? "result success" : "result error";
        resultDiv.innerHTML = `
            <h3>${failures === 0 ? "一括生成 完了" : "一括生成 完了（一部失敗）"}</h3>
            <p>成功 ${results.length - failures} / ${results.length}</p>
            <ul>${links || "<li>PDFリンクなし</li>"}</ul>
            ${errors ? `<h4>失敗一覧</h4><ul>${errors}</ul>` : ""}
        `;
        resultDiv.style.display = "block";
        if (failures === 0) {
            alert("生成できました");
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
            result.className = "result success";
            result.innerHTML = `<h3>クリーンアップ完了</h3><p>削除件数: ${data.deleted_files}</p>`;
        } else {
            result.className = "result error";
            result.innerHTML = `<h3>クリーンアップ失敗</h3><p>${escapeHtml(data.error || "unknown")}</p>`;
        }
        result.style.display = "block";
    }

    async function resetSettingsToDefault() {
        const confirmed = window.confirm(
            "保存済みのカスタム設定を削除して、デフォルト設定へ戻します。よろしいですか？"
        );
        if (!confirmed) return;

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
        result.className = "result success";
        result.innerHTML =
            "<h3>初期化 完了</h3><p>設定をデフォルト値（推奨フォント含む）へ戻しました。</p>";
        result.style.display = "block";
    }

    function applyQueryColorPreset() {
        const q = new URLSearchParams(window.location.search);
        const bg = q.get("bg");
        const fg = q.get("fg");
        const mode = q.get("mode");
        const font = q.get("font");
        if (mode) setMode(mode);
        if (bg) byId("bgColorInput").value = bg;
        if (fg) byId("fgColorInput").value = fg;
        if (font) setSelectedFont(font);

        const activeMode = getCurrentMode();
        const defaults = MODE_DEFAULT_COLORS[activeMode] || MODE_DEFAULT_COLORS.light;
        state.modeColors[activeMode] = {
            bg: normalizeHexColor(byId("bgColorInput").value, defaults.bg),
            fg: normalizeHexColor(byId("fgColorInput").value, defaults.fg),
        };
        updateColorPreview();
    }

    function applyCatalogColorPreset(scheme) {
        if (!scheme || typeof scheme !== "object") {
            return;
        }

        const modeRaw = String(scheme.mode || "").toLowerCase();
        const mode = SUPPORTED_MODES.includes(modeRaw) ? modeRaw : getCurrentMode();
        setMode(mode);

        const defaults = MODE_DEFAULT_COLORS[mode] || MODE_DEFAULT_COLORS.light;
        const bg = normalizeHexColor(scheme.bg, defaults.bg);
        const fg = normalizeHexColor(scheme.fg, defaults.fg);
        byId("bgColorInput").value = bg;
        byId("fgColorInput").value = fg;

        if (scheme.font) {
            setSelectedFont(String(scheme.font));
        }

        state.modeColors[mode] = { bg, fg };
        state.selectedColor.name = scheme.name ? String(scheme.name) : "catalog";
        state.selectedColor.mode = mode;
        updateColorPreview();
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
        byId("sourceFile").addEventListener("change", () => updateProgress(22));
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
        document.querySelectorAll("input[name='colorMode']").forEach((radio) => {
            radio.addEventListener("change", () => {
                applyModeStoredColors(getCurrentMode());
                loadColors().catch((error) => {
                    console.error(error);
                });
                updateProgress(60);
            });
        });

        byId("saveColorBtn").addEventListener("click", () => saveColorSettings().catch((e) => alert(e.message)));
        byId("fontFamilySelect").addEventListener("change", () => {
            setSelectedFont(byId("fontFamilySelect").value);
            updateProgress(72);
        });
        byId("refreshFontListBtn").addEventListener("click", () => {
            loadFonts(true).catch((e) => alert(e.message));
        });
        byId("generateBtn").addEventListener("click", () => generate(false));
        byId("generateAllBtn").addEventListener("click", () => generate(true));
        byId("cleanupBtn").addEventListener("click", () => cleanupNonPdf().catch((e) => alert(e.message)));
        byId("resetSettingsBtn").addEventListener("click", () =>
            resetSettingsToDefault().catch((e) => alert(e.message))
        );
        byId("restartServerBtn").addEventListener("click", () =>
            controlServer("restart").catch((e) => alert(e.message))
        );
        byId("stopServerBtn").addEventListener("click", () =>
            controlServer("stop").catch((e) => alert(e.message))
        );
        byId("mainWashiEnabled").addEventListener("change", (e) => {
            document.body.classList.toggle("washi-active", e.target.checked);
            updateProgress(72);
        });
        byId("mainFrameEnabled").addEventListener("change", () => {
            syncDeviceDependentDecorations();
            updateProgress(72);
        });
        byId("mainFrameVariant").addEventListener("change", () => updateProgress(72));
        byId("coverTextureEnabled").addEventListener("change", () => updateProgress(72));
        byId("coverTextureVariant").addEventListener("change", () => updateProgress(72));

        renderSizeReferenceSample();

        await loadSourceFiles();
        renderSources();
        await loadDevices();
        await loadSettings();
        await loadFonts(false);
        applyQueryColorPreset();
        await loadColors();
        updateProgress(76);

        if (byId("mainWashiEnabled").checked) {
            document.body.classList.add("washi-active");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error(error);
            alert("初期化に失敗しました: " + error.message);
        });
    });
})();
