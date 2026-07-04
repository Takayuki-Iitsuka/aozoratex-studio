/**
 * validation.ts
 * Zod による API ペイロードのランタイムバリデーション。
 * ブリッジ境界 (decorations, settings) の型安全性を強化。
 * プロポーザルに基づき導入。
 */
import { z } from "zod";

export const DeviceSchema = z.enum([
  "iphone",
  "iphone_plus",
  "android_phone",
  "ipad",
  "ipad_pro",
  "android_tablet",
  "pc",
  "smart",
  "tablet",
  "android",
  "ipad_landscape",
]);

export const OrientationSchema = z.enum(["portrait", "landscape"]);
export const ColumnModeSchema = z.enum(["single_column", "two_column"]);
export const RenderModeSchema = z.enum(["tikz", "image"]);

export const DecorationsSchema = z.object({
  main_washi_enabled: z.boolean().default(false),
  main_frame_enabled: z.boolean().default(false),
  main_frame_variant: z.coerce.number().int().min(1).max(5).default(1),
  cover_texture_enabled: z.boolean().default(true),
  cover_texture_variant: z.coerce.number().int().min(1).max(5).default(1),
  background_render_mode: RenderModeSchema.default("tikz"),
  cover_image_path: z.string().default(""),
  washi_image_path: z.string().default(""),
  cover_image_opacity: z.coerce.number().min(0).max(1).default(0.92),
  washi_image_opacity: z.coerce.number().min(0).max(1).default(0.18),
  page_number_enabled: z.boolean().default(true),
  body_column_mode: ColumnModeSchema.default("single_column"),
  device_orientation: OrientationSchema.optional(),
});

export type Decorations = z.infer<typeof DecorationsSchema>;

export const CompileRequestSchema = z.object({
  source: z.string().min(1),
  device: DeviceSchema,
  bg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font_family: z.string().nullable().optional(),
  compile_pdf: z.boolean().default(true),
  decorations: DecorationsSchema.partial().optional(),
});

export type CompileRequest = z.infer<typeof CompileRequestSchema>;

export const SettingsSchema = z.object({
  // グローバル設定の最小スキーマ (必要に応じて拡張)
  font_family: z.string().default("IPAmjMincho"),
  body_column_mode: ColumnModeSchema,
  main_washi_enabled: z.boolean(),
  // ... 他のフィールドは既存settings_storeに委ねる
});

// 青空文庫 書籍検索・ダウンロード (/api/library/*)
export const LibrarySearchQuerySchema = z.object({
  q: z.string().max(100).default(""),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type LibrarySearchQuery = z.infer<typeof LibrarySearchQuerySchema>;

export const LibraryDownloadRequestSchema = z.object({
  book_ids: z.array(z.string().regex(/^\d+$/)).min(1).max(100),
  overwrite: z.boolean().default(false),
});

export type LibraryDownloadRequest = z.infer<typeof LibraryDownloadRequestSchema>;

export function safeValidateLibrarySearchQuery(data: unknown) {
  const result = LibrarySearchQuerySchema.safeParse(data);
  if (!result.success) {
    return { success: false as const, error: z.flattenError(result.error) };
  }
  return { success: true as const, data: result.data };
}

export function safeValidateLibraryDownloadRequest(data: unknown) {
  const result = LibraryDownloadRequestSchema.safeParse(data);
  if (!result.success) {
    return { success: false as const, error: z.flattenError(result.error) };
  }
  return { success: true as const, data: result.data };
}

export function validateCompileRequest(data: unknown): CompileRequest {
  return CompileRequestSchema.parse(data);
}

export function safeValidateCompileRequest(data: unknown) {
  const result = CompileRequestSchema.safeParse(data);
  if (!result.success) {
    // zod 4 では error.flatten() が非推奨のためトップレベル関数を使用
    return { success: false as const, error: z.flattenError(result.error) };
  }
  return { success: true as const, data: result.data };
}
