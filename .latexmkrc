# AozoraTeX Studio 用 latexmk 設定 (LuaLaTeX + jlreq 縦書き)
# Makefile からフラグを集約。UI/CLIからも利用可。

$pdflatex = 'lualatex %O %S';
$lualatex = 'lualatex %O %S';
$pdflatex = $lualatex;   # 強制的に lualatex

$latex = 'lualatex %O %S';
$bibtex = 'bibtex %O %S';
$makeindex = 'makeindex %O -s japanese.ist -o %D %S';
$dvipdf = 'dvipdfmx %O -o %D %S';

$clean_ext = 'aux log fls fdb_latexmk out toc lof lot mtc mtc0 maf synctex.gz ltjruby blg bbl bcf run.xml idx ind ilg acn acr alg glo gls glg ist xdy nav snm vrb pdfsync xwm -blx.bib';

# 推奨フラグ (nonstop + エラー時停止 + synctex)
$latex = 'lualatex -interaction=nonstopmode -file-line-error -synctex=1 %O %S';
$lualatex = $latex;

# ハルトレベル
$halt_on_error = 1;

# PDF viewer 無効 (デスクトップアプリ想定)
$pdf_previewer = 'start ""';

# デフォルトで pdf 生成
$pdf_mode = 1;

# 補助: -c で中間ファイル削除時に追加拡張子を対象に
# 詳細は Makefile の LATEXMK_CLEAN_EXT を参照
1;  # スクリプトとして有効化
