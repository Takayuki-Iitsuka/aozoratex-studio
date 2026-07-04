"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

interface SidebarState {
  collapsed: boolean;
  width: number;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebar, setSidebar] = useLocalStorage<SidebarState>("aozoratex:sidebar", {
    collapsed: false,
    width: 240,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={sidebar.collapsed}
        width={sidebar.width}
        onWidthChange={(width) => setSidebar((prev) => ({ ...prev, width }))}
        onToggleCollapsed={() => setSidebar((prev) => ({ ...prev, collapsed: !prev.collapsed }))}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() =>
            setSidebar((prev) => ({ ...prev, collapsed: !prev.collapsed }))
          }
        />

        <main className="flex-1 relative px-4 sm:px-6 lg:px-8 py-6">
          {/* ダークテーマ時のみの背景装飾 */}
          <div className="hidden dark:block absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px] pointer-events-none" />
          <div className="hidden dark:block absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[128px] pointer-events-none" />
          <div className="relative max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
