import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { appConfig } from "./apps.mjs";

export async function readAgentFiles(directory) {
  const config = {
    system_prompt: await readFile(new URL("prompt.md", directory), "utf8"),
  };
  for (const name of ["mcp", "skills"]) {
    let value = [];
    try {
      value = JSON.parse(await readFile(new URL(`${name}.json`, directory), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!Array.isArray(value)) throw new Error(`${name}.json はJSON配列にしてください。`);
    config[name] = value;
  }
  return config;
}

export function originsFor(appId, env) {
  const { port } = appConfig(appId);
  const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  if (env.CODESPACE_NAME && env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)
    origins.push(
      `https://${env.CODESPACE_NAME}-${port}.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
    );
  for (const text of (env.SUBAKO_EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== text)
      throw new Error(
        "SUBAKO_EXTRA_ORIGINS はパスや末尾の / を含まないOriginで指定してください。",
      );
    origins.push(text);
  }
  return [...new Set(origins)];
}
export function modelFor(env, provider) {
  const model = env.SUBAKO_MODEL_ID?.trim();
  if (!model)
    throw new Error(
      "SUBAKO_MODEL_ID を設定してください。npm run agent:models で確認できます。",
    );
  const format = env.SUBAKO_MODEL_FORMAT || provider.format;
  if (format !== provider.format)
    throw new Error("SUBAKO_MODEL_FORMAT とproviderのformatが一致しません。");
  if (
    provider.type === "platform" &&
    !provider.models.some((item) => item.model === model)
  )
    throw new Error(
      "指定モデルはこのproviderの一覧にありません。npm run agent:models で確認してください。",
    );
  if (format === "anthropic") return { format, model, max_tokens: 4096 };
  if (format === "openai_responses") {
    const context_window = Number(env.SUBAKO_MODEL_CONTEXT_WINDOW);
    if (!Number.isInteger(context_window) || context_window <= 0)
      throw new Error(
        "OpenAI形式は SUBAKO_MODEL_CONTEXT_WINDOW に運営指定の値を入れてください。",
      );
    return { format, model, context_window, max_tokens: 4096 };
  }
  throw new Error("この教材ではanthropic / openai_responses形式を使えます。");
}
export function replaceEnvValue(source, name, value) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name) || /[\r\n]/.test(value))
    throw new Error("環境変数の形式が不正です。");
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  return re.test(source)
    ? source.replace(re, () => line)
    : `${source.trimEnd()}\n${line}\n`;
}
export const fingerprint = (value) =>
  createHash("sha256").update(value).digest("hex");

export async function publishAgent({
  client,
  state,
  config,
  name,
  origins,
  persist,
}) {
  let next = { ...state };
  if (next.agentId) {
    try {
      await client.agents.get(next.agentId);
    } catch (error) {
      if (error.status !== 404) throw error;
      next = {};
    }
  }
  if (!next.agentId) {
    const agent = await client.agents.create({ name });
    next.agentId = agent.id;
    await persist(next);
  }
  const hash = fingerprint(JSON.stringify(config));
  if (next.configHash !== hash) {
    const version = await client.agents.publishVersion(next.agentId, config);
    next = { ...next, configHash: hash, versionId: version.id };
    await persist(next);
  }
  const previous = await client.agents.getSecurity(next.agentId);
  await client.agents.setSecurity(next.agentId, {
    allowed_origins: [...new Set([...previous.allowed_origins, ...origins])],
  });
  return next;
}
