# --- 設定 ---
# 削除対象の中間ファイル / PDF
CLEAN_FILES = *.log *.aux *.ltjruby *.out_ext
OUT_DIR     = out
WORK_DIR = $(OUT_DIR)/work
PDF_DIR = $(OUT_DIR)/pdf
LATEXMK_BASE  = latexmk -lualatex
LATEXMK_FLAGS = -interaction=nonstopmode -file-line-error -halt-on-error -silent -use-make
LATEXMK_CLEAN_EXT = ltjruby out_ext out gz fls fdb_latexmk synctex.gz
CLEAN_TEX_FILES = $(sort $(wildcard $(OUT_DIR)/*.tex) $(wildcard $(OUT_DIR)/*/*.tex) $(wildcard $(OUT_DIR)/*/*/*.tex) $(wildcard $(OUT_DIR)/*/*/*/*.tex))

# 装飾オプション（空欄なら ini 設定を使用）
# 例: make pdf-PC WASHI=1 FRAME=2
WASHI ?=0
FRAME ?=0
COVER_TEXTURE ?=
COVER_VARIANT ?=1

AOZORA_DECOR_FLAGS =
ifneq ($(strip $(WASHI)),)
	ifeq ($(WASHI),1)
		AOZORA_DECOR_FLAGS += --main-washi
	else ifeq ($(WASHI),0)
		AOZORA_DECOR_FLAGS += --no-main-washi
	endif
endif

ifneq ($(strip $(FRAME)),)
	ifeq ($(FRAME),0)
		AOZORA_DECOR_FLAGS += --no-main-frame
	else
		AOZORA_DECOR_FLAGS += --main-frame --main-frame-variant $(FRAME)
	endif
endif

ifneq ($(strip $(COVER_TEXTURE)),)
	ifeq ($(COVER_TEXTURE),1)
		AOZORA_DECOR_FLAGS += --cover-texture --cover-texture-variant $(COVER_VARIANT)
	else ifeq ($(COVER_TEXTURE),0)
		AOZORA_DECOR_FLAGS += --no-cover-texture
	endif
endif

# `make` が `sh` で実行されても動くように OS 分岐
ifeq ($(OS),Windows_NT)
  RM_INTERMEDIATE = cmd /c del /s /q *.log *.aux *.ltjruby 2>nul || exit 0
  RM_PDF          = powershell -NoProfile -Command "Get-ChildItem -Recurse -Filter '*.pdf' | Remove-Item -Force"
	RM_OUT_AUX_ONLY = powershell -NoProfile -Command "if (Test-Path '$(OUT_DIR)') { Get-ChildItem -LiteralPath '$(OUT_DIR)' -Recurse -File | Where-Object Extension -notin '.pdf', '.tex' | Remove-Item -Force }"
  RM_OUT_CONTENTS = powershell -NoProfile -Command "if (Test-Path '$(OUT_DIR)') { Get-ChildItem -LiteralPath '$(OUT_DIR)' -Force | Remove-Item -Recurse -Force } ; New-Item -ItemType Directory -Path '$(OUT_DIR)' -Force | Out-Null"
define PREP_SESSION_DEVICE_DIRS
	@powershell -NoProfile -Command "New-Item -ItemType Directory -Path '$(WORK_DIR)/$(1)','$(PDF_DIR)/$(1)' -Force | Out-Null"
endef
define MOVE_LTJRUBY_TO_WORK
	@powershell -NoProfile -Command "Get-ChildItem -LiteralPath '.' -Filter '*.ltjruby' -File | Move-Item -Destination '$(WORK_DIR)/$(1)' -Force"
endef
define MOVE_PDF_TO_SESSION
	@powershell -NoProfile -Command "if (Test-Path '$(WORK_DIR)/$(1)') { New-Item -ItemType Directory -Path '$(PDF_DIR)/$(1)' -Force | Out-Null ; Get-ChildItem -LiteralPath '$(WORK_DIR)/$(1)' -Filter '*.pdf' -File | Move-Item -Destination '$(PDF_DIR)/$(1)' -Force }"
endef
else
  RM_INTERMEDIATE = find . -type f \( -name "*.log" -o -name "*.aux" -o -name "*.ltjruby" \) -delete
  RM_PDF          = find . -type f -name "*.pdf" -delete
	RM_OUT_AUX_ONLY = test ! -d "$(OUT_DIR)" || find "$(OUT_DIR)" -type f ! -name "*.pdf" ! -name "*.tex" -delete
  RM_OUT_CONTENTS = mkdir -p $(OUT_DIR) && find $(OUT_DIR) -mindepth 1 -delete
define PREP_SESSION_DEVICE_DIRS
	@mkdir -p "$(WORK_DIR)/$(1)" "$(PDF_DIR)/$(1)"
endef
define MOVE_LTJRUBY_TO_WORK
	@for f in *.ltjruby; do [ -f "$$f" ] && mv "$$f" "$(WORK_DIR)/$(1)/"; done
endef
define MOVE_PDF_TO_SESSION
	@for f in "$(WORK_DIR)/$(1)"/*.pdf; do [ -f "$$f" ] && mv "$$f" "$(PDF_DIR)/$(1)/"; done
endef
endif

define RUN_LUALATEX
	$(call PREP_SESSION_DEVICE_DIRS,$(1))
	$(LATEXMK_BASE) $(LATEXMK_FLAGS) -outdir=$(WORK_DIR)/$(1) -auxdir=$(WORK_DIR)/$(1) $(WORK_DIR)/$(1)/*.tex
	$(call MOVE_LTJRUBY_TO_WORK,$(1))
	$(call MOVE_PDF_TO_SESSION,$(1))
endef



# --- ターゲット定義 ---
.PHONY: help clean clean-all clean-out server test test-all install \
        pdf-iPhone pdf-Android pdf-PC pdf-iPad pdf-iPad-TwoColumn \
        pdf-iphone pdf-android pdf-pc pdf-ipad pdf-ipad-twocolumn

help:
	@printf '%s\n' 'AozoraTeX Studio - Makefile'
	@printf "\n"
	@printf '%s\n' 'Available commands:'
	@printf '%s\n' '  make install             - Install Python dependencies'
	@printf '%s\n' '  make server              - Start Flask server (port 5000)'
	@printf '%s\n' '  make test                - Run sample conversion test (.tex only)'
	@printf '%s\n' '  make test-all            - Run conversion tests for multiple devices'
	@printf '%s\n' '  make clean               - Remove intermediate files (keep out/*.pdf and out/*.tex)'
	@printf '%s\n' '  make clean-out           - Empty only the contents of out/'
	@printf '%s\n' '  make pdf-iPhone          - Generate iPhone PDF  (out/pdf/iphone/)'
	@printf '%s\n' '  make pdf-Android         - Generate Android PDF (out/pdf/android/)'
	@printf '%s\n' '  make pdf-PC              - Generate PC/A4 PDF   (out/pdf/pc/)'
	@printf '%s\n' '  make pdf-iPad            - Generate iPad portrait PDF (out/pdf/ipad/)'
	@printf '%s\n' '  make pdf-iPad-TwoColumn  - Generate iPad landscape PDF (out/pdf/ipad_landscape/)'
	@printf '%s\n' '  option: WASHI=1 FRAME=2  - Enable main washi + frame variant 2'
	@printf "\n"

# インストール
install:
	@echo Installing Python packages...
	.venv\Scripts\pip.exe install -r requirements.txt

# Flask サーバー起動
server:
	@echo Starting Flask server on http://0.0.0.0:5000
	.venv\Scripts\python.exe -m src.aozora_server

# テスト実行（iPhone用、ライトモード）— .tex 生成のみ
test:
	@echo Converting sample HTML to iPhone LaTeX...
	.venv\Scripts\python.exe -m src.aozoratex data/1567_14913.html --device iphone --mode light --verbose --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo Output: $(WORK_DIR)/iphone/*.tex

# 複数デバイス用テスト — .tex 生成のみ
test-all:
	@echo Converting to all devices...
	.venv\Scripts\python.exe -m src.aozoratex data/1567_14913.html --device iphone --mode light --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	.venv\Scripts\python.exe -m src.aozoratex data/1567_14913.html --device android --mode light --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	.venv\Scripts\python.exe -m src.aozoratex data/1567_14913.html --device pc --mode light --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo All conversions done

# 通常のクリーンアップ (log, aux, ltjruby + out内の非pdf/tex)
clean:
	@echo "Removing intermediate files with latexmk (-c)..."
	-@$(LATEXMK_BASE) -c -silent -f -e "\$$clean_ext='\$$clean_ext $(LATEXMK_CLEAN_EXT)'" $(CLEAN_TEX_FILES)
	-@$(RM_INTERMEDIATE)
	-@$(RM_OUT_AUX_ONLY)

# すべてのクリーンアップ (PDFを含む)
clean-all: clean
	@echo Removing PDF files...
	-@$(RM_PDF)

# out/ ディレクトリの中身だけを空にする
clean-out:
	@echo Emptying $(OUT_DIR)/ contents...
	@$(RM_OUT_CONTENTS)

# ============================================================
# PDF生成ターゲット（.tex 生成 → latexmk コンパイル）
# ============================================================

# iPhone用PDF生成
pdf-iPhone:
	@echo "Generating .tex for iphone..."
	.venv\Scripts\python.exe -m src.aozoratex data/ --device iphone --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo "Compiling PDF with latexmk..."
	$(call RUN_LUALATEX,iphone)
	@echo "Done: $(PDF_DIR)/iphone/"

# Android用PDF生成
pdf-Android:
	@echo "Generating .tex for android..."
	.venv\Scripts\python.exe -m src.aozoratex data/ --device android --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo "Compiling PDF with latexmk..."
	$(call RUN_LUALATEX,android)
	@echo "Done: $(PDF_DIR)/android/"

# PC用PDF生成
pdf-PC:
	@echo "Generating .tex for pc..."
	.venv\Scripts\python.exe -m src.aozoratex data/ --device pc --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo "Compiling PDF with latexmk..."
	$(call RUN_LUALATEX,pc)
	@echo "Done: $(PDF_DIR)/pc/"

# iPad用PDF生成（縦向き）
pdf-iPad:
	@echo "Generating .tex for ipad..."
	.venv\Scripts\python.exe -m src.aozoratex data/ --device ipad --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo "Compiling PDF with latexmk..."
	$(call RUN_LUALATEX,ipad)
	@echo "Done: $(PDF_DIR)/ipad/"

# iPad横向きPDF生成（二段組）
pdf-iPad-TwoColumn:
	@echo "Generating .tex for ipad_landscape..."
	.venv\Scripts\python.exe -m src.aozoratex data/ --device ipad_landscape --out $(OUT_DIR) $(AOZORA_DECOR_FLAGS)
	@echo "Compiling PDF with latexmk..."
	$(call RUN_LUALATEX,ipad_landscape)
	@echo "Done: $(PDF_DIR)/ipad_landscape/"

# lower-case aliases for CLI ergonomics/document consistency
pdf-iphone: pdf-iPhone
pdf-android: pdf-Android
pdf-pc: pdf-PC
pdf-ipad: pdf-iPad
pdf-ipad-twocolumn: pdf-iPad-TwoColumn
