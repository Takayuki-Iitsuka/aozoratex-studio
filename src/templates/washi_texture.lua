local page_w = {{page_width_mm}}
local page_h = {{page_height_mm}}

local config = {
    sunome = {
        enable = true,
        laid_spacing = {{laid_step_y}},
        chain_spacing = {{laid_step_x}} * 4.0,
        opacity = {{line_x_opacity}},
        jitter = 0.15,
    },
    patches = {
        count = {{patch_count}},
        max_radius = {{patch_rx_max_mm}},
        base_opacity = {{patch_op_max}},
    },
    long_fibers = {
        count = {{fiber_count}},
        min_length = {{fiber_len_min_mm}},
        max_length = {{fiber_len_max_mm}},
        curve_power = {{fiber_bend_max_mm}},
        base_opacity = {{fiber_op_max}},
    },
    short_fibers = {
        count = math.max(120, math.floor({{fiber_count}} * 1.8)),
        max_length = {{fiber_len_min_mm}},
        curve_power = math.max(1.2, {{fiber_bend_max_mm}} * 0.55),
        base_opacity = {{fiber_op_min}},
        clumping = 0.6,
    },
    specks = {
        count = {{speck_count}},
        max_radius = {{speck_radius_max_mm}},
        bark_ratio = 0.2,
    },
    vignette = {
        steps = 6,
        maxW = math.min(page_w, page_h) * 0.12,
        maxOp = 0.028,
    },
}

if not aozora_washi_seeded then
    local seed = os.time() + math.floor(1000000 * os.clock())
    math.randomseed(seed)
    aozora_washi_seeded = true
end

local function n(v, scale)
    local s = scale or 100
    if v >= 0 then
        return tostring(math.floor(v * s + 0.5) / s)
    end
    return tostring(math.ceil(v * s - 0.5) / s)
end

local function pick3(a, b, c)
    local r = math.random(3)
    if r == 1 then
        return a
    elseif r == 2 then
        return b
    end
    return c
end

local function pseudo_normal(center, spread)
    local r = (math.random() + math.random() + math.random() - 1.5) / 1.5
    return center + r * spread
end

local function draw_sunome()
    if not config.sunome.enable then
        return
    end

    for y = 0, page_h, config.sunome.laid_spacing do
        local path = "(0," .. n(y, 100) .. ")"
        for x = 20, page_w, 20 do
            local jitter = (math.random() - 0.5) * config.sunome.jitter
            path = path .. "--(" .. n(x, 100) .. "," .. n(y + jitter, 100) .. ")"
        end
        tex.sprint("\\draw[wDark,opacity=" .. n(config.sunome.opacity, 1000) .. ",line width=0.12mm] " .. path .. ";")
    end

    for x = 15, page_w, config.sunome.chain_spacing do
        local path = "(" .. n(x, 100) .. ",0)--(" .. n(x, 100) .. "," .. n(page_h, 100) .. ")"
        tex.sprint("\\draw[wDark,opacity=" .. n(config.sunome.opacity * 0.8, 1000) .. ",line width=0.09mm] " .. path .. ";")
    end
end

local function draw_patches(seed)
    math.randomseed(seed)

    for _ = 1, config.patches.count do
        local x = math.random() * (page_w + 20) - 10
        local y = math.random() * (page_h + 20) - 10
        local rx = 10 + math.random() * config.patches.max_radius
        local ry = 10 + math.random() * (config.patches.max_radius * 0.6)
        local ang = math.random() * 180
        local col = pick3("wLight", "wDark", "wF1")
        local op = config.patches.base_opacity * pick3(0.5, 1.0, 1.5)
        local shape = "(" .. n(x, 10) .. "," .. n(y, 10) .. ") ellipse[x radius=" .. n(rx, 10) .. "mm, y radius=" .. n(ry, 10) .. "mm, rotate=" .. n(ang, 10) .. "]"
        tex.sprint("\\fill[" .. col .. ",opacity=" .. n(op, 1000) .. "] " .. shape .. ";")
    end
end

local function draw_long_fibers(seed)
    math.randomseed(seed)

    for _ = 1, config.long_fibers.count do
        local x = math.random() * (page_w + 20) - 10
        local y = math.random() * (page_h + 20) - 10
        local ang = math.random() * math.pi
        local len = config.long_fibers.min_length + math.random() * (config.long_fibers.max_length - config.long_fibers.min_length)
        local dx = math.cos(ang) * len
        local dy = math.sin(ang) * len
        local jit = config.long_fibers.curve_power
        local cx1 = x + dx * 0.3 + (math.random() - 0.5) * jit * 2
        local cy1 = y + dy * 0.3 + (math.random() - 0.5) * jit * 2
        local cx2 = x + dx * 0.7 + (math.random() - 0.5) * jit * 2
        local cy2 = y + dy * 0.7 + (math.random() - 0.5) * jit * 2

        local col = pick3("wF1", "wF2", "wF3")
        local op = config.long_fibers.base_opacity * pick3(0.5, 1.0, 1.5)
        local lw = pick3(0.05, 0.12, 0.22)
        local seg = "(" .. n(x, 100) .. "," .. n(y, 100) .. ")..controls(" .. n(cx1, 100) .. "," .. n(cy1, 100) .. ")and(" .. n(cx2, 100) .. "," .. n(cy2, 100) .. ")..(" .. n(x + dx, 100) .. "," .. n(y + dy, 100) .. ")"
        tex.sprint("\\draw[" .. col .. ",opacity=" .. n(op, 100) .. ",line width=" .. n(lw, 100) .. "mm,line cap=round] " .. seg .. ";")
    end
end

local function draw_short_fibers(seed)
    math.randomseed(seed)

    local cluster_count = 15
    local clusters_x = {}
    local clusters_y = {}
    for i = 1, cluster_count do
        clusters_x[i] = math.random() * page_w
        clusters_y[i] = math.random() * page_h
    end

    for _ = 1, config.short_fibers.count do
        local x
        local y
        if math.random() < config.short_fibers.clumping then
            local ci = math.random(cluster_count)
            x = pseudo_normal(clusters_x[ci], 30)
            y = pseudo_normal(clusters_y[ci], 30)
        else
            x = math.random() * (page_w + 20) - 10
            y = math.random() * (page_h + 20) - 10
        end

        local ang = math.random() * math.pi
        local len = 1.0 + math.random() * (config.short_fibers.max_length - 1.0)
        local dx = math.cos(ang) * len
        local dy = math.sin(ang) * len
        local jit = config.short_fibers.curve_power
        local cx = x + dx * 0.5 + (math.random() - 0.5) * jit
        local cy = y + dy * 0.5 + (math.random() - 0.5) * jit

        local col = pick3("wF2", "wF3", "wSpeck")
        local op = config.short_fibers.base_opacity * pick3(0.6, 1.0, 1.6)
        local lw = pick3(0.04, 0.08, 0.12)
        local seg = "(" .. n(x, 100) .. "," .. n(y, 100) .. ")..controls(" .. n(cx, 100) .. "," .. n(cy, 100) .. ")..(" .. n(x + dx, 100) .. "," .. n(y + dy, 100) .. ")"
        tex.sprint("\\draw[" .. col .. ",opacity=" .. n(op, 100) .. ",line width=" .. n(lw, 100) .. "mm,line cap=round] " .. seg .. ";")
    end
end

local function draw_specks(seed)
    math.randomseed(seed)

    for _ = 1, config.specks.count do
        local x = math.random() * page_w
        local y = math.random() * page_h
        local col = "wSpeck"
        if math.random() < config.specks.bark_ratio then
            col = "wBark"
        end
        local op = pick3(0.15, 0.25, 0.40)
        local r = 0.1 + math.random() * math.max(config.specks.max_radius - 0.1, 0.1)
        tex.sprint("\\fill[" .. col .. ",opacity=" .. n(op, 100) .. "] (" .. n(x, 100) .. "," .. n(y, 100) .. ") circle[radius=" .. n(r, 100) .. "mm];")
    end
end

local function draw_vignette(steps, maxW, maxOp)
    for i = 1, steps do
        local m = maxW * i / steps
        local op = maxOp * (steps - i + 1) / steps
        tex.sprint("\\fill[wDark,opacity=" .. n(op, 100000) .. "](0,0)rectangle(" .. n(m, 100) .. "," .. n(page_h, 100) .. ");")
        tex.sprint("\\fill[wDark,opacity=" .. n(op, 100000) .. "](" .. n(page_w - m, 100) .. ",0)rectangle(" .. n(page_w, 100) .. "," .. n(page_h, 100) .. ");")
        tex.sprint("\\fill[wDark,opacity=" .. n(op, 100000) .. "](0,0)rectangle(" .. n(page_w, 100) .. "," .. n(m, 100) .. ");")
        tex.sprint("\\fill[wDark,opacity=" .. n(op, 100000) .. "](0," .. n(page_h - m, 100) .. ")rectangle(" .. n(page_w, 100) .. "," .. n(page_h, 100) .. ");")
    end
end

tex.sprint("\\begin{scope}[shift={(current page.south west)}]")
tex.sprint("\\clip (0,0) rectangle (" .. n(page_w, 100) .. "," .. n(page_h, 100) .. ");")
tex.sprint("\\fill[wBase] (0,0) rectangle (" .. n(page_w, 100) .. "," .. n(page_h, 100) .. ");")
draw_sunome()
draw_patches(101)
draw_long_fibers(2025)
draw_short_fibers(3456)
draw_specks(7777)
draw_vignette(config.vignette.steps, config.vignette.maxW, config.vignette.maxOp)
tex.sprint("\\end{scope}")
