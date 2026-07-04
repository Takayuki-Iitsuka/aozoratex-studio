"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PENDING_SELECTION_KEY } from "@/lib/hooks/useDataFiles";
import type { LogEntry } from "@/lib/hooks/useCompile";

export interface LibraryBook {
  book_id: string;
  title: string;
  title_reading: string;
  kana_type: string;
  html_url: string;
  card_url: string;
  filename: string;
  author: string;
  author_reading: string;
  downloaded: boolean;
  path: string;
}

export interface LibraryStatus {
  cached: boolean;
  updated_at: string | null;
  total: number;
}

export interface DownloadResultItem {
  book_id: string;
  title?: string;
  filename?: string;
  path?: string;
  status: "downloaded" | "skipped" | "failed";
  error?: string;
}

export interface DownloadSummary {
  success: boolean;
  results: DownloadResultItem[];
  downloaded: number;
  skipped: number;
  failed: number;
  error?: string;
}

export const LIBRARY_PAGE_SIZE = 50;
const LIBRARY_STATE_KEY = "aozoratex.libraryState";
const LIBRARY_HISTORY_KEY = "aozoratex.librarySearchHistory";
const LIBRARY_HISTORY_LIMIT = 10;

interface PersistedLibraryState {
  query?: string;
  offset?: number;
  selectedIds?: string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeHistoryItem(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

// 青空文庫の作品インデックス検索と data/ への一括ダウンロード（/library ページ用）
export function useLibrary() {
  const router = useRouter();
  const restored = useRef(false);
  const initialSearchOffset = useRef(0);

  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [isUpdatingIndex, setIsUpdatingIndex] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryBook[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [activeBook, setActiveBook] = useState<LibraryBook | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadLogs, setDownloadLogs] = useState<LogEntry[]>([]);
  const [downloadSummary, setDownloadSummary] = useState<DownloadSummary | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = readJson<PersistedLibraryState>(LIBRARY_STATE_KEY, {});
      if (typeof saved.query === "string") setQuery(saved.query);
      if (typeof saved.offset === "number" && Number.isFinite(saved.offset)) {
        const savedOffset = Math.max(0, saved.offset);
        setOffset(savedOffset);
        initialSearchOffset.current = savedOffset;
      }
      if (Array.isArray(saved.selectedIds)) {
        setSelectedIds(uniqueStrings(saved.selectedIds.filter((id) => /^\d+$/.test(id))));
      }
      setSearchHistory(
        uniqueStrings(readJson<string[]>(LIBRARY_HISTORY_KEY, []).map(normalizeHistoryItem)).slice(
          0,
          LIBRARY_HISTORY_LIMIT
        )
      );
      restored.current = true;
    });
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(
        LIBRARY_STATE_KEY,
        JSON.stringify({
          query,
          offset,
          selectedIds,
        } satisfies PersistedLibraryState)
      );
    } catch {
      // localStorage が使えない場合はページ内 state のみで継続する
    }
  }, [query, offset, selectedIds]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(LIBRARY_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch {
      // localStorage が使えない場合はページ内 state のみで継続する
    }
  }, [searchHistory]);

  const rememberSearch = useCallback((rawQuery: string) => {
    const normalized = normalizeHistoryItem(rawQuery);
    if (!normalized) return;
    setSearchHistory((prev) =>
      [normalized, ...prev.filter((item) => item !== normalized)].slice(0, LIBRARY_HISTORY_LIMIT)
    );
  }, []);

  const refreshStatus = useCallback(() => {
    return fetch("/api/library/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setStatus({
            cached: json.cached,
            updated_at: json.updated_at,
            total: json.total,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load library status:", err);
      });
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const search = useCallback(async (q: string, searchOffset: number) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q,
        offset: String(searchOffset),
        limit: String(LIBRARY_PAGE_SIZE),
      });
      const res = await fetch(`/api/library/search?${params}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.items);
        setTotal(json.total);
        setActiveBook((current) => {
          if (current && json.items.some((book: LibraryBook) => book.book_id === current.book_id)) {
            return current;
          }
          return json.items[0] ?? null;
        });
      } else if (json.error === "index_not_ready") {
        setResults([]);
        setTotal(0);
        setActiveBook(null);
      } else {
        toast.error(`検索に失敗しました: ${json.error || "不明なエラー"}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`検索に失敗しました: ${message}`);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 初回は保存済み offset を使い、それ以降のクエリ変更は先頭ページから検索する
  useEffect(() => {
    if (!status?.cached || !restored.current) return;
    const timer = setTimeout(() => {
      const nextOffset = initialSearchOffset.current;
      initialSearchOffset.current = 0;
      setOffset(nextOffset);
      search(query, nextOffset);
      rememberSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, status?.cached, search, rememberSearch]);

  const goToOffset = (nextOffset: number) => {
    const clamped = Math.max(0, nextOffset);
    setOffset(clamped);
    search(query, clamped);
    rememberSearch(query);
  };

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setOffset(0);
  };

  const useHistoryQuery = (nextQuery: string) => {
    changeQuery(nextQuery);
    rememberSearch(nextQuery);
  };

  const removeSearchHistory = (item: string) => {
    setSearchHistory((prev) => prev.filter((value) => value !== item));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const updateIndex = async () => {
    setIsUpdatingIndex(true);
    try {
      const res = await fetch("/api/library/update-index", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(`作品インデックスを更新しました（全 ${json.total} 作品）`);
        await refreshStatus();
      } else {
        toast.error(json.error || "インデックスの更新に失敗しました。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`インデックスの更新に失敗しました: ${message}`);
    } finally {
      setIsUpdatingIndex(false);
    }
  };

  const toggleBook = (bookId: string) => {
    setSelectedIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const selectActiveBook = (book: LibraryBook) => {
    setActiveBook(book);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const openPathsInGenerate = useCallback(
    (paths: string[]) => {
      const cleanPaths = uniqueStrings(paths);
      if (cleanPaths.length === 0) {
        toast.error("PDF生成に引き継げるファイルがありません。");
        return;
      }
      try {
        sessionStorage.setItem(PENDING_SELECTION_KEY, JSON.stringify(cleanPaths));
      } catch {
        // sessionStorage が使えない場合は選択なしで遷移する
      }
      router.push("/generate");
    },
    [router]
  );

  const openDownloadedBookInGenerate = (book: LibraryBook) => {
    if (!book.downloaded || !book.path) {
      toast.error("この作品はまだダウンロードされていません。");
      return;
    }
    openPathsInGenerate([book.path]);
  };

  const downloadSelected = async (overwrite: boolean) => {
    if (selectedIds.length === 0) {
      toast.error("ダウンロードする作品を選択してください。");
      return;
    }

    setIsDownloading(true);
    setDownloadLogs([]);
    setDownloadSummary(null);

    try {
      const response = await fetch("/api/library/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_ids: selectedIds, overwrite }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value);
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const eventData = JSON.parse(line.substring(6));
              if (eventData.type === "log") {
                setDownloadLogs((prev) => [
                  ...prev,
                  { type: "log", content: `${eventData.content}\n` },
                ]);
              } else if (eventData.type === "stderr") {
                setDownloadLogs((prev) => [
                  ...prev,
                  { type: "stderr", content: eventData.content },
                ]);
              } else if (eventData.type === "result") {
                const summary = eventData.data as DownloadSummary;
                setDownloadSummary(summary);
                if (summary.success) {
                  toast.success(
                    `ダウンロード完了: ${summary.downloaded} 件取得 / ${summary.skipped} 件スキップ / ${summary.failed} 件失敗`
                  );
                } else {
                  toast.error(summary.error || "ダウンロードに失敗しました。");
                }
              }
            } catch {
              // Ignore parsing errors of raw chunks
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`ダウンロードに失敗しました: ${message}`);
      setDownloadLogs((prev) => [
        ...prev,
        { type: "error", content: `Error occurred during download: ${message}` },
      ]);
    } finally {
      setIsDownloading(false);
      // DL済みバッジを最新化するため現在ページを再検索
      search(query, offset);
    }
  };

  // DL結果のファイルを選択済みにして /generate へ遷移する
  const openInGenerate = () => {
    const paths = (downloadSummary?.results ?? [])
      .filter((r) => (r.status === "downloaded" || r.status === "skipped") && r.path)
      .map((r) => r.path as string);
    openPathsInGenerate(paths);
  };

  const groupedResults = useMemo(() => {
    const groups: Array<{ key: string; title: string; author: string; books: LibraryBook[] }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const book of results) {
      const key = `${book.title}\u0000${book.author}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.books.push(book);
      } else {
        const group = { key, title: book.title, author: book.author, books: [book] };
        groups.push(group);
        byKey.set(key, group);
      }
    }
    return groups;
  }, [results]);

  return {
    status,
    refreshStatus,
    isUpdatingIndex,
    updateIndex,
    query,
    setQuery: changeQuery,
    searchHistory,
    useHistoryQuery,
    removeSearchHistory,
    clearSearchHistory,
    results,
    groupedResults,
    activeBook,
    selectActiveBook,
    total,
    offset,
    goToOffset,
    isSearching,
    selectedIds,
    toggleBook,
    clearSelection,
    isDownloading,
    downloadLogs,
    downloadSummary,
    downloadSelected,
    openDownloadedBookInGenerate,
    openInGenerate,
  };
}
