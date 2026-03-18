使えるコマンドは次の整理です。

いまのMakefileのまま実行できる最も近いもの

make pdf-iphone

本当に iPhone + dark にしたい場合の実行コマンド

.venv\Scripts\python.exe -m src.aozoratex data/ --device iphone --mode dark --out out/iphone-dark

補足すると、このスクリプトは名前に反して PDF そのものは作らず、.tex を生成するだけです。aozoratex.py:6
PDFまで出すなら、その後で lualatex を2回実行します。aozoratex.py:768

lualatex -interaction=nonstopmode -output-directory out/iphone-dark out/iphone-dark/1567_14913.tex
lualatex -interaction=nonstopmode -output-directory out/iphone-dark out/iphone-dark/1567_14913.tex

必要なら、make pdf-iphone-dark を Makefile にどう追加すればよいかもそのまま書けます。

# 1. スマホデバイスで .tex ファイル生成（ページ番号確認）

python -m src.aozoratex data/テスト.html --device iphone --mode light --out out/test_iphone
grep -i "pagestyle\|nombre" out/test_iphone/*.tex

# 2. PC デバイスでページ番号が残ることを確認

python -m src.aozoratex data/テスト.html --device pc --mode light --out out/test_pc
grep -i "pagestyle\|nombre" out/test_pc/*.tex

# 3. JIS計算値の確認

python -c "
from src.aozoratex import build_tex_file

# ページ出力から kanjiskip が含まれるか確認

"

ければならん︒そこで昔からこんにち今日
