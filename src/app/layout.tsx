import "./globals.css";
import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsProvider } from "@/lib/contexts/SettingsContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AozoraTeX Studio",
  description: "青空文庫 HTML から美しい縦書き PDF を生成するデスクトップ・スタジオ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes が <html> の class を書き換えるため suppressHydrationWarning が必要
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansJP.variable} antialiased min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <SettingsProvider>
            <AppShell>{children}</AppShell>
          </SettingsProvider>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
