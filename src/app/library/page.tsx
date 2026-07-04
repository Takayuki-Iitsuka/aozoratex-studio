"use client";

import React, { useState } from "react";
import {
  Search,
  Check,
  X,
  Download,
  RefreshCw,
  DatabaseZap,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  BookOpen,
} from "lucide-react";

import { useLibrary, LIBRARY_PAGE_SIZE } from "@/lib/hooks/useLibrary";
import { StepCard } from "@/components/StepCard";
import { Terminal } from "@/components/Terminal";

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "不明";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ja-JP");
}

function describeKanaType(kanaType: string): string {
  if (!kanaType) return "不明";
  if (kanaType.includes("旧仮名")) return "昔のかなづかい版";
  if (kanaType.includes("新仮名")) return "現代かなづかい版";
  return kanaType;
}

export default function LibraryPage() {
  const library = useLibrary();
  const [overwrite, setOverwrite] = useState(false);

  const indexReady = library.status?.cached === true;
  const pageStart = library.total === 0 ? 0 : library.offset + 1;
  const pageEnd = library.offset + library.results.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">書籍検索</h1>
        <p className="text-sm text-muted-foreground">
          青空文庫の作品を検索し、入力ファイルとしてダウンロードします。
        </p>
      </div>

      {/* 作品インデックスの状態 */}
      <section className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              作品インデックス
            </span>
            {library.status === null ? (
              <p className="text-sm text-muted-foreground">状態を確認中...</p>
            ) : indexReady ? (
              <p className="text-sm text-foreground/90">
                全{" "}
                <span className="font-bold text-accent">
                  {library.status.total.toLocaleString()}
                </span>{" "}
                作品 / 最終更新: {formatUpdatedAt(library.status.updated_at)}
              </p>
            ) : (
              <p className="text-sm text-foreground/90">
                作品インデックスが未取得です。取得すると全作品を検索できます。
              </p>
            )}
          </div>
          <button
            onClick={library.updateIndex}
            disabled={library.isUpdatingIndex}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 ${
              indexReady
                ? "bg-muted hover:bg-muted/70 text-foreground border border-border"
                : "bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg"
            }`}
          >
            {indexReady ? (
              <RefreshCw size={14} className={library.isUpdatingIndex ? "animate-spin" : ""} />
            ) : (
              <DatabaseZap size={14} />
            )}
            {library.isUpdatingIndex
              ? "取得中..."
              : indexReady
                ? "インデックスを更新"
                : "インデックスを取得"}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 検索と結果一覧 */}
        <div className="lg:col-span-8 space-y-6">
          <StepCard
            stepLabel="Step 1"
            title="作品を検索"
            description="作品名・読み・著者名の部分一致で検索できます（スペース区切りでAND検索）。"
            icon={<Search size={18} />}
            headerAction={
              <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold">
                {library.selectedIds.length} 件選択
              </span>
            }
          >
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                type="text"
                placeholder="例: 走れメロス / 太宰 治 / わがはい"
                value={library.query}
                onChange={(e) => library.setQuery(e.target.value)}
                disabled={!indexReady}
                className="w-full pl-10 pr-4 py-2 text-sm bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-hidden focus:border-accent transition disabled:opacity-50"
              />
            </div>

            {library.searchHistory.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">検索履歴</span>
                {library.searchHistory.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 text-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => library.useHistoryQuery(item)}
                      className="px-2 py-1 text-xs hover:text-accent transition"
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      onClick={() => library.removeSearchHistory(item)}
                      className="pr-1.5 text-muted-foreground hover:text-rose-500 transition"
                      aria-label={`${item} を検索履歴から削除`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={library.clearSearchHistory}
                  className="px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  履歴を消去
                </button>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-input/50">
              {!indexReady ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  作品インデックスを取得すると検索できます
                </div>
              ) : library.groupedResults.length > 0 ? (
                library.groupedResults.map((group) => {
                  const firstBook = group.books[0];
                  const isGrouped = group.books.length > 1;
                  return (
                    <div key={group.key} className="bg-input/20">
                      <div className={`${isGrouped ? "px-3.5 pt-3.5 pb-2" : "hidden"}`}>
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <div className="font-semibold text-sm text-foreground/90 truncate">
                            {group.title}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
                            {group.books.length} 版
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {group.author}
                            {firstBook?.title_reading && ` ・ ${firstBook.title_reading}`}
                          </span>
                        </div>
                      </div>

                      <div className={isGrouped ? "divide-y divide-border/40" : ""}>
                        {group.books.map((book) => {
                          const isSelected = library.selectedIds.includes(book.book_id);
                          const isActive = library.activeBook?.book_id === book.book_id;
                          return (
                            <div
                              key={book.book_id}
                              onClick={() => library.selectActiveBook(book)}
                              className={`flex items-center justify-between gap-3 p-3.5 text-sm cursor-pointer transition ${
                                isActive
                                  ? "bg-accent/10"
                                  : isSelected
                                    ? "bg-muted/50"
                                    : "hover:bg-muted/40"
                              } ${isGrouped ? "pl-6" : ""}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    library.toggleBook(book.book_id);
                                  }}
                                  aria-label={`${book.title} をダウンロード対象に${isSelected ? "しない" : "する"}`}
                                  className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "border-accent bg-accent text-accent-foreground"
                                      : "border-border bg-transparent"
                                  }`}
                                >
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </button>
                                <div className="min-w-0">
                                  <div
                                    className={`truncate ${
                                      isActive ? "text-accent font-medium" : "text-foreground/90"
                                    }`}
                                  >
                                    {isGrouped ? describeKanaType(book.kana_type) : book.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {isGrouped ? (
                                      <>
                                        作品ID {book.book_id} ・ {book.filename}
                                      </>
                                    ) : (
                                      <>
                                        {book.author}
                                        {book.title_reading && ` ・ ${book.title_reading}`}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {book.kana_type && !isGrouped && (
                                  <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                    {describeKanaType(book.kana_type)}
                                  </span>
                                )}
                                {book.downloaded && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
                                    DL済み
                                  </span>
                                )}
                                {book.downloaded && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      library.openDownloadedBookInGenerate(book);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition inline-flex items-center gap-1"
                                  >
                                    PDF生成 <ArrowRight size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {library.isSearching ? "検索中..." : "該当する作品がありません"}
                </div>
              )}
            </div>

            {indexReady && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  全 {library.total.toLocaleString()} 件中 {pageStart}–{pageEnd} 件
                  {library.groupedResults.length !== library.results.length &&
                    ` / ${library.groupedResults.length} グループ表示`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => library.goToOffset(library.offset - LIBRARY_PAGE_SIZE)}
                    disabled={library.offset === 0 || library.isSearching}
                    className="px-3 py-1.5 font-semibold bg-muted hover:bg-muted/70 disabled:opacity-40 text-foreground border border-border rounded-lg transition flex items-center gap-1"
                  >
                    <ChevronLeft size={12} /> 前へ
                  </button>
                  <button
                    onClick={() => library.goToOffset(library.offset + LIBRARY_PAGE_SIZE)}
                    disabled={pageEnd >= library.total || library.isSearching}
                    className="px-3 py-1.5 font-semibold bg-muted hover:bg-muted/70 disabled:opacity-40 text-foreground border border-border rounded-lg transition flex items-center gap-1"
                  >
                    次へ <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </StepCard>
        </div>

        {/* Right: ダウンロード実行 */}
        <div className="lg:col-span-4 space-y-6">
          <StepCard
            stepLabel="Step 2"
            title="図書カード / ダウンロード"
            description="検索結果をクリックすると詳細を確認できます。"
            icon={<BookOpen size={18} />}
          >
            {library.activeBook ? (
              <div className="rounded-xl border border-border bg-input/40 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {library.activeBook.title}
                    </h3>
                    {library.activeBook.downloaded && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
                        DL済み
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{library.activeBook.author}</p>
                </div>

                <dl className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">作品ID</dt>
                    <dd className="font-mono text-foreground/90">{library.activeBook.book_id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">作品名読み</dt>
                    <dd className="text-foreground/90 truncate">
                      {library.activeBook.title_reading || "不明"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">作者読み</dt>
                    <dd className="text-foreground/90 truncate">
                      {library.activeBook.author_reading || "不明"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">文字遣い</dt>
                    <dd className="text-foreground/90 text-right">
                      {describeKanaType(library.activeBook.kana_type)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">HTML</dt>
                    <dd className="font-mono text-foreground/90 truncate">
                      {library.activeBook.filename}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={library.activeBook.card_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-lg transition inline-flex items-center gap-1"
                  >
                    青空文庫の図書カード <ExternalLink size={12} />
                  </a>
                  {library.activeBook.downloaded && (
                    <button
                      type="button"
                      onClick={() => library.openDownloadedBookInGenerate(library.activeBook!)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition inline-flex items-center gap-1"
                    >
                      PDF生成 <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-input/40 p-4 text-sm text-muted-foreground">
                検索結果を選択すると、図書カード情報を表示します。
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="accent-[--color-accent]"
              />
              既存ファイルを上書きする（OFF時はスキップ）
            </label>

            <div className="space-y-3">
              <button
                onClick={() => library.downloadSelected(overwrite)}
                disabled={library.isDownloading || library.selectedIds.length === 0}
                className="w-full py-4 text-sm font-bold bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Download size={16} />
                {library.isDownloading
                  ? "ダウンロード中..."
                  : `選択した ${library.selectedIds.length} 件をダウンロード`}
              </button>

              <button
                onClick={library.clearSelection}
                disabled={library.isDownloading || library.selectedIds.length === 0}
                className="w-full py-2.5 text-xs font-semibold bg-muted hover:bg-muted/70 disabled:opacity-50 text-foreground border border-border rounded-xl transition"
              >
                選択を解除
              </button>
            </div>

            {library.downloadSummary && (
              <div
                className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  library.downloadSummary.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300"
                }`}
              >
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span className="font-medium">
                    {library.downloadSummary.downloaded} 件取得 /{" "}
                    {library.downloadSummary.skipped} 件スキップ /{" "}
                    {library.downloadSummary.failed} 件失敗
                  </span>
                </div>
                {library.downloadSummary.results
                  .filter((r) => r.status === "failed")
                  .map((r) => (
                    <div key={r.book_id} className="text-xs">
                      作品ID {r.book_id}
                      {r.title ? `（${r.title}）` : ""}: {r.error}
                    </div>
                  ))}
                {library.downloadSummary.downloaded + library.downloadSummary.skipped > 0 && (
                  <button
                    onClick={library.openInGenerate}
                    className="self-start px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition inline-flex items-center gap-1"
                  >
                    PDF生成ページで開く <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )}
          </StepCard>

          <Terminal
            logs={library.downloadLogs}
            visible={library.isDownloading || library.downloadLogs.length > 0}
          />
        </div>
      </div>
    </div>
  );
}
