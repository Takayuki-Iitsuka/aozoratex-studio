"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface DataFile {
  name: string;
  path: string;
  downloaded_at: string;
  book_id: string;
  title: string;
  title_reading: string;
  kana_type: string;
  author: string;
  author_reading: string;
}

// /library の「PDF生成ページで開く」から選択ファイルを引き継ぐための
// sessionStorage キー（値は path 配列の JSON、読み取り後に削除する）
export const PENDING_SELECTION_KEY = "aozoratex.pendingSelection";

// data/ ディレクトリ内の入力ファイル一覧と選択状態（/generate ページ用）
export function useDataFiles() {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const pendingConsumed = useRef(false);

  // setState は fetch 完了後のコールバックで行う（effect 本体の同期 setState を避ける）
  const refresh = useCallback(() => {
    return fetch("/api/data-files")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return;
        setFiles(json.files);

        // /library から渡された選択を、一覧に実在する path に限定して一度だけ適用
        if (pendingConsumed.current) return;
        pendingConsumed.current = true;
        try {
          const raw = sessionStorage.getItem(PENDING_SELECTION_KEY);
          if (!raw) return;
          sessionStorage.removeItem(PENDING_SELECTION_KEY);
          const pending: unknown = JSON.parse(raw);
          if (!Array.isArray(pending)) return;
          const available = new Set((json.files as DataFile[]).map((f) => f.path));
          const applicable = pending.filter(
            (p): p is string => typeof p === "string" && available.has(p)
          );
          if (applicable.length > 0) setSelectedFiles(applicable);
        } catch {
          // sessionStorage が使えない環境では引き継ぎをあきらめる
        }
      })
      .catch((err) => {
        console.error("Failed to load data files:", err);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredAndSortedFiles = useMemo(() => {
    return [...files]
      .filter((file) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return [file.name, file.title, file.title_reading, file.author, file.author_reading]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.name.localeCompare(b.name);
        if (sortBy === "name-desc") return b.name.localeCompare(a.name);
        if (sortBy === "downloaded-desc") {
          return new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime();
        }
        if (sortBy === "downloaded-asc") {
          return new Date(a.downloaded_at).getTime() - new Date(b.downloaded_at).getTime();
        }
        const aId = parseInt(a.name.match(/^\d+/)?.[0] || "0");
        const bId = parseInt(b.name.match(/^\d+/)?.[0] || "0");
        if (sortBy === "id-asc") return aId - bId;
        if (sortBy === "id-desc") return bId - aId;
        return 0;
      });
  }, [files, searchQuery, sortBy]);

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) =>
      prev.includes(path) ? prev.filter((f) => f !== path) : [...prev, path]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles(filteredAndSortedFiles.map((f) => f.path));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
  };

  return {
    files,
    refresh,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedFiles,
    setSelectedFiles,
    filteredAndSortedFiles,
    toggleFile,
    selectAllFiles,
    clearAllFiles,
  };
}
