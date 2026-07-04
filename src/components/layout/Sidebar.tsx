"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Activity,
  Home,
  Search,
  FileOutput,
  Settings,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_COLLAPSED_WIDTH = 60;

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/library", label: "書籍検索", icon: Search },
  { href: "/generate", label: "PDF生成", icon: FileOutput },
  { href: "/preview", label: "プレビュー", icon: Eye },
  { href: "/settings", label: "設定", icon: Settings },
  { 
    href: "/system-info", 
    label: "システム情報", 
    icon: Info,
    children: [
      { href: "/system-status", label: "システム状況", icon: Activity },
      { href: "/system-updates", label: "アップデート管理", icon: Download },
    ]
  },
];

interface SidebarProps {
  collapsed: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, width, onWidthChange, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  
  // 子メニューの開閉状態（デフォルトで全て開く）
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/system-info": true
  });

  // 右端ハンドルのドラッグでサイドバー幅を変更する
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const left = asideRef.current?.getBoundingClientRect().left ?? 0;
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, ev.clientX - left));
      onWidthChange(Math.round(next));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const effectiveWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;

  return (
    <aside
      ref={asideRef}
      style={{ width: effectiveWidth }}
      className="relative shrink-0 h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-md flex flex-col transition-[width] duration-150"
    >
      {/* ブランド */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-4 h-14 border-b border-border/60 shrink-0 overflow-hidden"
        title="AozoraTeX Studio"
      >
        <BookMarked size={20} className="text-accent shrink-0" />
        {!collapsed && (
          <span className="font-bold text-sm tracking-tight whitespace-nowrap">
            AozoraTeX <span className="text-muted-foreground font-normal">Studio</span>
          </span>
        )}
      </Link>

      {/* ナビゲーション */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon, children }) => {
          const isActive = pathname === href;
          const isChildActive = children?.some(c => pathname === c.href);
          const isExpanded = expanded[href] !== false; // default true
          
          return (
            <div key={href} className="space-y-1">
              {children ? (
                // 子メニューがある場合はトグルボタン（遷移せず開閉のみ）にする実装も考えられますが、
                // 親ページ（/system-info）が存在するため、リンク遷移＋開閉トグルの両方を行います。
                <Link
                  href={href}
                  title={label}
                  onClick={() => {
                    // 遷移はそのままさせつつ、開閉状態をトグルする
                    setExpanded(prev => ({ ...prev, [href]: !isExpanded }));
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition whitespace-nowrap ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    isActive || (isChildActive && collapsed)
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && (
                    <span className="shrink-0 text-muted-foreground/70">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                  )}
                </Link>
              ) : (
                <Link
                  href={href}
                  title={label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition whitespace-nowrap ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    isActive || (isChildActive && collapsed)
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              )}
              
              {!collapsed && children && isExpanded && (
                <div className="pl-6 space-y-1">
                  {children.map((child) => {
                    const isSubActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        title={child.label}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition whitespace-nowrap ${
                          isSubActive
                            ? "bg-accent/10 text-accent"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <child.icon size={15} className="shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 折りたたみトグル */}
      <div className="p-2 border-t border-border/60">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose size={17} className="shrink-0" />
              <span className="text-xs">折りたたむ</span>
            </>
          )}
        </button>
      </div>

      {/* 幅リサイズハンドル（展開時のみ） */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="サイドバー幅の変更"
          onPointerDown={handleResizeStart}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors touch-none"
        />
      )}
    </aside>
  );
}
