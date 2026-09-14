import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { subakoDevApi } from "../../scripts/subako-dev-api.ts";

const envDir = fileURLToPath(new URL("../../", import.meta.url));
const codespace = process.env.CODESPACE_NAME;
const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const host = codespace && domain ? `${codespace}-5176.${domain}` : undefined;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, ["SUBAKO_", "VITE_SUBAKO_"]);
  return {
    plugins: [
      react(),
      // APIキーを持つのは開発サーバーだけです。ブラウザーはこの口から会話に入ります。
      subakoDevApi({
        apiKey: env.SUBAKO_API_KEY ?? "",
        agentId: env.SUBAKO_AGENT_MAP_COFFEE ?? "",
        baseUrl: env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai",
        title: "渋谷コーヒー巡り",
      }),
    ],
    envDir,
    preview: { port: 5176, strictPort: true },
    server: {
      host: "0.0.0.0",
      port: 5176,
      strictPort: true,
      ...(host ? { allowedHosts: [host] } : {}),
    },
  };
});
