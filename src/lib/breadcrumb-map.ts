// パスとページ名の対応表（Sidebar のナビと Breadcrumbs で共用）
export const PAGE_LABELS: Record<string, string> = {
  "/": "ホーム",
  "/library": "書籍検索",
  "/generate": "PDF生成",
  "/preview": "プレビュー",
  "/settings": "設定",
  "/system-info": "システム情報",
  "/system-status": "システム状況",
};

export function labelForPath(pathname: string): string {
  return PAGE_LABELS[pathname] ?? pathname;
}
