-- jigmo_coverage.lua
-- LuaLaTeX コンパイル時に jigmo 系フォントの Unicode カバレッジを動的確認する。
--
-- 使用例:
--   directlua から require("jigmo_coverage") を呼び出す
--   directlua から tex.print(jigmo_select(0x6DF9) or "") を呼び出す

local M = {}

-- フォント名 -> codepoint集合のキャッシュ
local _coverage_cache = {}
-- フォント名 -> 実ファイルパスのキャッシュ
local _font_path_cache = {}

local function mark_codepoint(cps, value)
  if type(value) ~= "number" then return end
  if value < 0 or value > 0x10FFFF then return end
  cps[value] = true
end

local function resolve_font_path(fontname)
  if _font_path_cache[fontname] ~= nil then
    return _font_path_cache[fontname]
  end

  local path = nil
  local candidates = {
    fontname .. ".otf",
    fontname .. ".ttf",
  }
  for _, file in ipairs(candidates) do
    path = kpse.find_file(file, "opentype fonts")
      or kpse.find_file(file, "truetype fonts")
      or kpse.find_file(file)
    if path and path ~= "" then
      break
    end
  end

  _font_path_cache[fontname] = path
  return path
end

local function load_coverage(fontname)
  if _coverage_cache[fontname] then
    return _coverage_cache[fontname]
  end

  local cps = {}
  local font_path = resolve_font_path(fontname) or fontname
  local f = fontloader.open(font_path)
  if f then
    local t = fontloader.to_table(f)
    fontloader.close(f)

    if t and t.map and t.map.map then
      -- TeX Live のバージョン差で key/value の向きが異なる場合があるため両方試す
      for key, value in pairs(t.map.map) do
        mark_codepoint(cps, key)
        mark_codepoint(cps, value)
      end
    end

    if t and t.characters then
      for cp, _ in pairs(t.characters) do
        mark_codepoint(cps, cp)
      end
    end

    if t and t.encodingmapping then
      for _, entry in ipairs(t.encodingmapping) do
        if entry and entry.unicode then
          mark_codepoint(cps, entry.unicode)
        end
      end
    end
  end

  _coverage_cache[fontname] = cps
  return cps
end

--- Unicode コードポイントをカバーする jigmo フォント名を返す
--- @param codepoint number|string
--- @return string|nil
function M.jigmo_select(codepoint)
  local cp = tonumber(codepoint)
  if not cp then
    return nil
  end

  local candidates = { "jigmo", "jigmo2", "jigmo3" }
  for _, name in ipairs(candidates) do
    local cov = load_coverage(name)
    if cov[cp] then
      return name
    end
  end
  return nil
end

-- 後方互換: グローバル関数名を残す
jigmo_select = M.jigmo_select

return M
