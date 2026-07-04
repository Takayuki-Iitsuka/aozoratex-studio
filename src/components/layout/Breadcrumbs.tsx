"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { labelForPath } from "@/lib/breadcrumb-map";

export function Breadcrumbs() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav aria-label="パンくずリスト" className="flex items-center gap-1.5 text-sm min-w-0">
      {isHome ? (
        <span className="font-medium text-foreground">ホーム</span>
      ) : (
        <>
          <Link href="/" className="text-muted-foreground hover:text-foreground transition">
            ホーム
          </Link>
          <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
          <span className="font-medium text-foreground truncate">{labelForPath(pathname)}</span>
        </>
      )}
    </nav>
  );
}
