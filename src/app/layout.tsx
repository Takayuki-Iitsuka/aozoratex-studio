import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "AozoraTeX Studio",
  description: "青空文庫 HTML から美しい縦書き PDF を生成するデスクトップ・スタジオ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
