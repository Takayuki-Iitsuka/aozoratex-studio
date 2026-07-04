"use client";

import Link from "next/link";
import { Activity, Eye, FileOutput, Home, Info, PanelLeft, Search, Settings } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const HEADER_LINKS = [
  { href: "/library", label: "書籍検索", icon: Search },
  { href: "/generate", label: "PDF生成", icon: FileOutput },
  { href: "/preview", label: "プレビュー", icon: Eye },
  { href: "/settings", label: "設定", icon: Settings },
  { href: "/system-info", label: "システム情報", icon: Info },
  { href: "/system-status", label: "システム状況", icon: Activity },
];

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center gap-2 px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="サイドバーの表示切替"
        title="サイドバーの表示切替"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
      >
        <PanelLeft size={16} />
      </button>

      <Link
        href="/"
        aria-label="ホームへ戻る"
        title="ホームへ戻る"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
      >
        <Home size={16} />
      </Link>

      <div className="w-px h-5 bg-border mx-1" />

      <Breadcrumbs />

      <div className="flex-1" />

      <nav className="hidden md:flex items-center gap-1 border-r border-border pr-2 mr-1">
        {HEADER_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <Icon size={16} />
          </Link>
        ))}
      </nav>

      <ThemeToggle />
    </header>
  );
}
