"use client";

import React from "react";
import { Search, Check } from "lucide-react";
import { DataFile } from "@/lib/hooks/useAozoraData";

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
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="ファイル名で検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-950/80 border border-white/5 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-950/80 border border-white/5 rounded-xl text-zinc-300 focus:outline-none focus:border-purple-500 transition"
          >
            <option value="name-asc">名前順（昇順）</option>
            <option value="name-desc">名前順（降順）</option>
            <option value="id-asc">作品ID順（昇順）</option>
            <option value="id-desc">作品ID順（降順）</option>
          </select>
        </div>
        <div className="sm:col-span-3 flex gap-2">
          <button
            onClick={onSelectAll}
            className="flex-1 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 rounded-xl transition"
          >
            全選択
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 rounded-xl transition"
          >
            解除
          </button>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5 bg-zinc-950/30">
        {filteredAndSortedFiles.length > 0 ? (
          filteredAndSortedFiles.map((file) => {
            const isSelected = selectedFiles.includes(file.path);
            return (
              <div
                key={file.path}
                onClick={() => onToggle(file.path)}
                className={`flex items-center justify-between p-3.5 text-sm cursor-pointer transition ${
                  isSelected ? "bg-purple-500/[0.04]" : "hover:bg-white/[0.01]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-purple-500 bg-purple-500 text-black"
                        : "border-zinc-700 bg-transparent"
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span
                    className={`${isSelected ? "text-purple-300 font-medium" : "text-zinc-300"}`}
                  >
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-zinc-600 font-mono hidden sm:inline">
                  {file.path}
                </span>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-sm text-zinc-500">
            対象のHTMLファイルが見つかりません
          </div>
        )}
      </div>
    </div>
  );
}
