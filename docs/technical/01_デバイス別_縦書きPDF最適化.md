# デバイス別_縦書きPDF最適化設定

このドキュメントでは、各デバイス環境（Android, PC, iPad, iPhone）における画面・アスペクト比の特性と、それに最適化されたLuaLaTeX（jlreq）による縦書きPDF生成の設定値についてまとめます。

---

## 1. 現代のAndroid端末向け設定
**ターゲット:** 最新のAndroid端末 (9:20 アスペクト比, 例: Pixelシリーズなど)
**特徴:** 縦長画面をフル活用し、没入感のある読書体験を提供。

```latex
% 現代のAndroid端末 (9:20アスペクト比) に合わせた縦書き設定
\documentclass[
  paper={70mm, 155.5mm},   % 幅70mmに対する9:20の高さ (70 * 20/9)
  fontsize=11pt,           % 視認性を確保する11pt
  tate,                    % 縦書き
  jafontsize=11pt,
  head_space=5mm,          % 上部余白 (AndroidのStatus Barを考慮)
  foot_space=7mm,          % 下部余白 (Navigation Barの領域を考慮してやや広め)
  gutter=4mm,              % のど余白
  fore-edge=4mm            % 小口余白
]{jlreq}

\usepackage{luatexja}
\usepackage[haranoaji]{luatexja-preset}

\begin{document}
ここにテキストを入力します。
\end{document}
```
**注意点:** 機種によってナビゲーションバーの領域が異なるため、`foot_space` が隠れるリスクがあります。

---

## 2. PC画面（16:9モニター）向け設定
**ターゲット:** 標準的なPCの横長ディスプレイ
**特徴:** 全画面表示で美しい見開き2段組を実現し、長時間の読書でも眼の疲労を軽減。

```latex
% PCモニター (16:9) の全画面表示に最適化した横長・縦書き2段組設定
\documentclass[
  paper={297mm, 167.0625mm}, % A4の長辺(297mm)を基準とした16:9の論理サイズ (297 * 9 / 16)
  fontsize=13pt,             % PCの視距離に合わせた大きめのフォント
  tate,                      % 縦書き
  twocolumn,                 % 2段組
  jafontsize=13pt,
  head_space=15mm,           % 余白は広めにとり、圧迫感を減らす
  foot_space=15mm,
  gutter=15mm,               % のど余白（本の中央部分）
  fore-edge=15mm,            % 小口余白（画面の左右端）
  column_gap=15mm            % 段と段の間隔
]{jlreq}
```
**注意点:** 物理的なA4用紙へ印刷するには不向きです（余白が大きくなります）。

---

## 3. iPad（第10世代 10.9インチ）向け設定
**ターゲット:** iPad 横向き（Landscape）表示
**特徴:** 実際の文庫本（A5判相当）の見開きを再現する2段組レイアウト。

```latex
% iPad (第10世代) 横向き・二段組の実寸サイズに合わせた設定
\documentclass[
  paper={227.1mm, 157.8mm}, % iPad 10th Genの物理寸法（横×縦）
  fontsize=11pt,            % 視認性の高い11pt
  tate,                     % 縦書き
  twocolumn,                % 二段組
  jafontsize=11pt,
  head_space=15mm,          % 上部余白（Status BarやViewerのUIを避ける）
  foot_space=15mm,          % 下部余白
  gutter=10mm,              % のど（中央）余白
  fore-edge=15mm,           % 小口（左右端）余白
  column_gap=10mm           % 段間の余白
]{jlreq}
```
**注意点:** 発光デバイスのため、紙と同様の大きな余白はかえって眩しさを生む可能性があります。背景色の調整も併せて検討してください。

---

## 4. iPhone向け設定
**ターゲット:** iPhone 11 (アスペクト比 約19.5:9)
**特徴:** 実寸サイズに合わせて論理寸法を固定し、100%表示での閲覧に最適化します。

```latex
% iPhone 11の実寸サイズに合わせた縦書き設定
\documentclass[
  paper={64.5mm, 139.6mm}, % iPhone 11の物理寸法
  fontsize=11pt,           % 10pt〜12ptの間で調整
  tate,                    % 縦書き
  jafontsize=11pt,
  line_length=30zenkaku,   % 1行あたりの文字数
  head_space=5mm,          % 上部余白
  foot_space=5mm,          % 下部余白
  gutter=5mm,              % のど（右側）余白
  fore-edge=5mm            % 小口（左側）余白
]{jlreq}
```
**注意点:** iPhone 11の寸法に完全に固定されるため、他デバイスで見た場合は黒帯が発生します。

---

---

## 5. 対応デバイス一覧（現行実装）

`aozoratex.py` の `DEVICE_SIZES`（定数定義）と `settings.ini` のセクション定義を合わせた、現在の対応デバイス一覧です。

### 📋 対応デバイス一覧（計 8 種類）

| # | デバイス名 (`--device`) | 用紙サイズ (W × H mm) | 備考 |
|---|---|---|---|
| 1 | `iphone` | 65.0 × 140.0 | iPhone 11 実寸 |
| 2 | `android` | 70.0 × 155.5 | 現代型 Android (9:20) |
| 3 | `android_legacy` | 70.0 × 124.0 | 旧型 Android (9:16) 互換 |
| 4 | `ipad_portrait` | 158.0 × 227.0 | iPad 10th Gen 縦向き・単段組 |
| 5 | `ipad_landscape` | 227.0 × 158.0 | iPad 10th Gen 横向き・**二段組推奨** |
| 6 | `pc` | 210.0 × 297.0 | A4 |
| 7 | `smartphone` | 70.0 × 140.0 | 汎用スマートフォン（互換性用エイリアス） |
| 8 | `ipad` | 158.0 × 227.0 | iPad 縦向きの旧エイリアス（互換性用） |

### 📝 補足

- **実質的なユニークサイズは 6 種類**です。`smartphone` は `iphone` に近く、`ipad` は `ipad_portrait` と全く同じサイズです（互換性のためのエイリアス）。
- デフォルト（`--device` 指定なし）は **A4（210 × 297 mm）** になります。
- `settings.ini` に `[PDF_<デバイス名>]` セクションを追加すれば、**カスタムデバイスも自由に追加可能**な設計です。

---

*※ この文書は、各デバイス向け設定ドキュメントおよび「対応ディバイス一覧.md」を統合したものです。*
