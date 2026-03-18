(function () {
    "use strict";

    const state = {
        sourceFiles: [],
        devices: {},
        selectedDevice: null,
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

    function updateProgress(percent) {
        byId("progress").style.width = `${percent}%`;
    }

    function getCurrentMode() {
        const checked = document.querySelector("input[name='colorMode']:checked");
        return checked ? checked.value : "light";
    }

    function setMode(mode) {
        const value = ["light", "dark", "intermediate"].includes(mode) ? mode : "light";
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
        const all = Array.from(document.querySelectorAll(".source-check")).map((cb) => cb.value);
        if (forceAll) return all;

        const selected = Array.from(document.querySelectorAll(".source-check:checked")).map((cb) => cb.value);
        if (selected.length > 0) return selected;

        const single = byId("sourceFile").value;
        return single ? [single] : [];
    }

    function updateDevicePreview() {
        const info = state.devices[state.selectedDevice];
        if (!info) return;

        byId("deviceMeta").textContent = `${state.selectedDevice}: ${info.width} x ${info.height} mm`;
        const box = byId("devicePreviewBox");
        const max = 180;
        const ratio = info.width / info.height;
        if (ratio >= 1) {
            box.style.width = `${max}px`;
            box.style.height = `${Math.max(40, Math.round(max / ratio))}px`;
        } else {
            box.style.height = `${max}px`;
            box.style.width = `${Math.max(40, Math.round(max * ratio))}px`;
        }

        const iframe = byId("deviceMapFrame");
        iframe.src = `/device-paper-size-map.html?device=${encodeURIComponent(state.selectedDevice)}`;
    }

    async function loadDevices() {
        const resp = await fetch("/api/devices");
        const devices = await resp.json();
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
    }

    async function loadSettings() {
        const resp = await fetch("/api/settings");
        const payload = await resp.json();
        if (!payload.success) return;

        const settings = payload.settings || {};
        const globalSettings = settings.global || {};
        setMode(globalSettings.color_mode || "light");

        if (globalSettings.background_color) byId("bgColorInput").value = globalSettings.background_color;
        if (globalSettings.text_color) byId("fgColorInput").value = globalSettings.text_color;
        updateColorPreview();
    }

    async function loadColors() {
        const mode = getCurrentMode();
        const paletteMode = mode === "intermediate" ? "all" : mode;
        const resp = await fetch(`/api/colors?mode=${encodeURIComponent(paletteMode)}&limit=160`);
        const data = await resp.json();
        const grid = byId("colorGrid");
        grid.innerHTML = "";

        const schemes = data.schemes || [];
        schemes.forEach((scheme) => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="color-swatch" style="background:${scheme.bg};color:${scheme.fg};">Aa</div>
                <div class="card-label">${escapeHtml(scheme.name)}</div>
                <div class="card-desc">${escapeHtml(scheme.category || "")}<br>BG ${scheme.bg} / FG ${scheme.fg}</div>
            `;
            card.addEventListener("click", () => {
                document.querySelectorAll("#colorGrid .card").forEach((c) => c.classList.remove("active"));
                card.classList.add("active");
                state.selectedColor = {
                    mode,
                    name: scheme.name,
                    bg: scheme.bg,
                    fg: scheme.fg,
                };
                byId("bgColorInput").value = scheme.bg;
                byId("fgColorInput").value = scheme.fg;
                updateColorPreview();
                updateProgress(68);
            });
            grid.appendChild(card);
        });

        const first = grid.querySelector(".card");
        if (first) first.click();
    }

    async function saveColorSettings() {
        if (!state.selectedDevice) {
            alert("デバイスを選択してください");
            return;
        }

        const mode = getCurrentMode();
        const bg = (byId("bgColorInput").value || "#FFFFFF").toUpperCase();
        const fg = (byId("fgColorInput").value || "#000000").toUpperCase();

        const payload = {
            global: {
                color_mode: mode,
                background_color: bg,
                text_color: fg,
            },
            devices: {
                [state.selectedDevice]: {
                    color_mode: mode,
                },
            },
        };
        payload.global[`background_color_${mode}`] = bg;
        payload.global[`text_color_${mode}`] = fg;

        const resp = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            const result = byId("result");
            result.className = "result success";
            result.innerHTML = "<h3>設定保存 完了</h3><p>背景色・文字色をカスタム設定に保存しました。</p>";
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
        const bg = byId("bgColorInput").value || "#FFFFFF";
        const fg = byId("fgColorInput").value || "#000000";

        byId("loading").style.display = "block";
        const resultDiv = byId("result");
        resultDiv.style.display = "none";
        updateProgress(0);

        const payloadBase = {
            device: state.selectedDevice,
            mode,
            bg_color: bg,
            fg_color: fg,
            compile_pdf: true,
        };

        const results = [];
        let failures = 0;
        for (let i = 0; i < selectedSources.length; i += 1) {
            byId("loadingText").textContent = `生成中... ${i + 1}/${selectedSources.length}`;
            const source = selectedSources[i];
            try {
                const resp = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payloadBase, source }),
                });
                const data = await resp.json();
                data.source = source;
                data.success = Boolean(data.success);
                results.push(data);
                if (!data.success) failures += 1;
            } catch (err) {
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
                    ${item.pdf_url ? `<p><a href="${item.pdf_url}" target="_blank">PDFを開く</a></p>` : ""}
                `;
            } else {
                resultDiv.className = "result error";
                resultDiv.innerHTML = `<h3>生成失敗</h3><p>${escapeHtml(item.error || "unknown error")}</p>`;
            }
            resultDiv.style.display = "block";
            return;
        }

        const links = results
            .filter((r) => r.success && r.pdf_url)
            .map((r) => `<li><a href="${r.pdf_url}" target="_blank">${escapeHtml(r.source)} の PDF</a></li>`)
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
    }

    async function cleanupNonPdf() {
        const resp = await fetch("/api/session/cleanup-nonpdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        });
        const data = await resp.json();
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

    function applyQueryColorPreset() {
        const q = new URLSearchParams(window.location.search);
        const bg = q.get("bg");
        const fg = q.get("fg");
        const mode = q.get("mode");
        if (mode) setMode(mode);
        if (bg) byId("bgColorInput").value = bg;
        if (fg) byId("fgColorInput").value = fg;
        updateColorPreview();
    }

    async function init() {
        const sourceJson = byId("source-files-json");
        state.sourceFiles = JSON.parse(sourceJson.textContent || "[]");

        byId("sourceSearch").addEventListener("input", renderSources);
        byId("sourceSort").addEventListener("change", renderSources);
        byId("sourceFile").addEventListener("change", () => updateProgress(22));
        byId("selectAllBtn").addEventListener("click", () => selectAllSources(true));
        byId("clearAllBtn").addEventListener("click", () => selectAllSources(false));

        byId("bgColorInput").addEventListener("input", updateColorPreview);
        byId("fgColorInput").addEventListener("input", updateColorPreview);
        document.querySelectorAll("input[name='colorMode']").forEach((radio) => {
            radio.addEventListener("change", () => {
                loadColors();
                updateProgress(60);
            });
        });

        byId("saveColorBtn").addEventListener("click", () => saveColorSettings().catch((e) => alert(e.message)));
        byId("generateBtn").addEventListener("click", () => generate(false));
        byId("generateAllBtn").addEventListener("click", () => generate(true));
        byId("cleanupBtn").addEventListener("click", () => cleanupNonPdf().catch((e) => alert(e.message)));

        renderSources();
        await loadDevices();
        await loadSettings();
        applyQueryColorPreset();
        await loadColors();
        updateProgress(76);
    }

    document.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error(error);
            alert("初期化に失敗しました: " + error.message);
        });
    });
})();

