import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Prettier と競合する整形系ルールを無効化（最後に置く）
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Python 仮想環境・生成物・同梱ベンダー資産は lint 対象外
      ".venv/**",
      ".pytest_cache/**",
      "static/**",
      "assets/**",
      "backup/**",
      "Temp/**",
      "tools/**",
      "data/**",
    ],
  },
];

export default eslintConfig;
