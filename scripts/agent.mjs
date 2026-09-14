import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { SubakoClient } from "@subako-ai/sdk";
import { appConfig, agentVariable } from "./apps.mjs";
import {
  fingerprint,
  modelFor,
  originsFor,
  publishAgent,
  readAgentFiles,
  replaceEnvValue,
} from "./agent-support.mjs";

const rootUrl = new URL("../", import.meta.url);
const root = fileURLToPath(rootUrl);
const env = { ...process.env, ...loadEnv("development", root, "") };
const key = env.SUBAKO_API_KEY?.trim();
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
async function atomicWrite(path, text) {
  const tmp = `${fileURLToPath(path)}.tmp`;
  await writeFile(tmp, text, { mode: 0o600 });
  await rename(tmp, path);
}
async function run() {
  const [command, id] = process.argv.slice(2);
  if (!["models", "publish", "origins"].includes(command))
    throw new Error(
      "agent:models / agent:publish / agent:origins を使ってください。",
    );
  if (!key)
    throw new Error(
      "npm run setup の後、.env.local に SUBAKO_API_KEY を入力してください。",
    );
  const client = new SubakoClient({
    baseUrl: env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai",
    apiKey: key,
  });
  if (command === "models") {
    for await (const provider of await client.modelProviders.list({
      limit: 100,
    })) {
      console.log(
        `${provider.display_name}\n  provider: ${provider.id}\n  format: ${provider.format}`,
      );
      for (const model of provider.models ?? [])
        console.log(`  model: ${model.model} (${model.display_name})`);
    }
    return;
  }
  const app = appConfig(id);
  await mkdir(new URL(".hackathon/", rootUrl), { recursive: true });
  const scope = fingerprint(`${env.VITE_SUBAKO_BASE_URL}|${key}`).slice(0, 16);
  const path = new URL(`.hackathon/${id}-${scope}.json`, rootUrl);
  let state = await readJson(path, {});
  const persist = async (value) => {
    state = value;
    await atomicWrite(path, JSON.stringify(value, null, 2) + "\n");
  };
  const origins = originsFor(id, env);
  if (command === "publish") {
    const providerId = env.SUBAKO_MODEL_PROVIDER_ID?.trim();
    if (!providerId)
      throw new Error(
        "SUBAKO_MODEL_PROVIDER_ID を設定してください。npm run agent:models で確認できます。",
      );
    const provider = await client.modelProviders.get(providerId);
    const config = {
      model_provider_id: providerId,
      model: modelFor(env, provider),
      ...await readAgentFiles(new URL(`agents/${id}/`, rootUrl)),
    };
    state = await publishAgent({
      client,
      state,
      config,
      name: `hackathon-0914-${id}`,
      origins,
      persist,
    });
  } else {
    if (!state.agentId)
      throw new Error(
        `先に npm run agent:publish -- ${id} を実行してください。`,
      );
    const security = await client.agents.getSecurity(state.agentId);
    await client.agents.setSecurity(state.agentId, {
      allowed_origins: [...new Set([...security.allowed_origins, ...origins])],
    });
  }
  // 会話はアプリが作るので、ここで渡すのはagentの居場所だけです。
  const envPath = new URL(".env.local", rootUrl);
  const current = await readFile(envPath, "utf8");
  await atomicWrite(
    envPath,
    replaceEnvValue(current, agentVariable(id), state.agentId),
  );
  console.log(`${app.title} の準備が完了しました。`);
  console.log("APIキーは表示しません。");
  console.log(`開発サーバーを再起動してください: npm run dev -- ${id}`);
  console.log("指示を変えた後は、画面の「新しいセッション」で会話を作り直します。");
}
run().catch((error) => {
  const message = String(error.message || error);
  console.error(key ? message.replaceAll(key, "[非表示]") : message);
  process.exitCode = 1;
});
