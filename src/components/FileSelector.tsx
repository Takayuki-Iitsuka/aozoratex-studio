"use client";

import React from "react";
import { Search, Check } from "lucide-react";
import { DataFile } from "@/lib/hooks/useDataFiles";

interface FileSelectorProps {
  files: DataFile[];
  filteredAndSortedFiles: DataFile[];
  selectedFiles: string[];
  searchQuery: string;
  sortBy: string;
  onSearchChange: (q: string) => void;
  onSortChange: (s: string) => void;
  onToggle: (path: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function FileSelector({
  filteredAndSortedFiles,
  selectedFiles,
  searchQuery,
  sortBy,
  onSearchChange,
  onSortChange,
  onToggle,
  onSelectAll,
  onClearAll,
}: FileSelectorProps) {
  const formatDownloadedAt = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "不明";
    return date.toLocaleString("ja-JP");
  };

  const describeKanaType = (kanaType: string) => {
    if (!kanaType) return "";
    if (kanaType.includes("旧仮名")) return "昔のかなづかい版";
    if (kanaType.includes("新仮名")) return "現代かなづかい版";
    return kanaType;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <input
            type="text"
            placeholder="作品名・作者・ファイル名で検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-hidden focus:border-accent transition"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-xl text-foreground focus:outline-hidden focus:border-accent transition"
          >
            <option value="name-asc">名前順（昇順）</option>
            <option value="name-desc">名前順（降順）</option>
            <option value="id-asc">作品ID順（昇順）</option>
            <option value="id-desc">作品ID順（降順）</option>
            <option value="downloaded-desc">ダウンロード日時（新しい順）</option>
            <option value="downloaded-asc">ダウンロード日時（古い順）</option>
          </select>
        </div>
        <div className="sm:col-span-3 flex gap-2">
          <button
            onClick={onSelectAll}
            className="flex-1 py-2 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition"
          >
            全選択
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 py-2 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition"
          >
            解除
          </button>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-input/50">
        {filteredAndSortedFiles.length > 0 ? (
          filteredAndSortedFiles.map((file) => {
            const isSelected = selectedFiles.includes(file.path);
            const primaryLabel = file.title
              ? `${file.title}${file.author ? ` / ${file.author}` : ""}`
              : file.name;
            const secondaryParts = [
              file.name,
              file.book_id ? `作品ID ${file.book_id}` : "",
              describeKanaType(file.kana_type),
              `DL ${formatDownloadedAt(file.downloaded_at)}`,
            ].filter(Boolean);
            return (
              <div
                key={file.path}
                onClick={() => onToggle(file.path)}
                className={`flex items-center justify-between p-3.5 text-sm cursor-pointer transition ${
                  isSelected ? "bg-accent/10" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-transparent"
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`truncate ${
                        isSelected ? "text-accent font-medium" : "text-foreground/90"
                      }`}
                    >
                      {primaryLabel}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {secondaryParts.join(" ・ ")}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground/70 font-mono hidden sm:inline">
                  {file.path}
                </span>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            対象のHTMLファイルが見つかりません
          </div>
        )}
      </div>
    </div>
  );
}
