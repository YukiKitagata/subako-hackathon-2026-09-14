import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  originsFor,
  modelFor,
  replaceEnvValue,
  publishAgent,
  readAgentFiles,
} from "../agent-support.mjs";

test("prompt・MCP・Skillsを読み、設定変更を次のpublishへ渡す", async () => {
  const path = await mkdtemp(join(tmpdir(), "hackathon-agent-"));
  const directory = pathToFileURL(`${path}/`);
  try {
    await writeFile(new URL("prompt.md", directory), "選び方を工夫する");
    assert.deepEqual(await readAgentFiles(directory), {
      system_prompt: "選び方を工夫する", mcp: [], skills: [],
    });
    const mcp = [{ name: "search", url: "https://example.com/mcp" }];
    const skills = [{ name: "decision-guide", skill_id: "example-skill", version: "latest" }];
    await writeFile(new URL("mcp.json", directory), JSON.stringify(mcp));
    await writeFile(new URL("skills.json", directory), JSON.stringify(skills));
    const config = await readAgentFiles(directory);
    assert.deepEqual(config.mcp, mcp);
    assert.deepEqual(config.skills, skills);
    let state = {};
    const versions = [];
    const client = { agents: {
      get: async () => ({}),
      create: async () => ({ id: "agent" }),
      publishVersion: async (_id, body) => { versions.push(body); return { id: String(versions.length) }; },
      getSecurity: async () => ({ allowed_origins: [] }),
      setSecurity: async () => {},
    } };
    const publish = async () => publishAgent({
      client, state, config: await readAgentFiles(directory), name: "example", origins: [],
      persist: async (next) => { state = next; },
    });
    await publish();
    await publish();
    await writeFile(new URL("skills.json", directory), "[]");
    await publish();
    assert.equal(versions.length, 2);
    assert.deepEqual(versions[0].skills, skills);
    assert.deepEqual(versions[1].skills, []);
    await writeFile(new URL("skills.json", directory), "{}");
    await assert.rejects(readAgentFiles(directory), /skills.json はJSON配列/);
    await writeFile(new URL("skills.json", directory), "[");
    await assert.rejects(readAgentFiles(directory), SyntaxError);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});

test("Codespacesのアプリ別Originを生成し、パス付きOriginは拒否する", () => {
  assert.ok(
    originsFor("map-coffee", {
      CODESPACE_NAME: "demo",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    }).includes("https://demo-5176.app.github.dev"),
  );
  assert.throws(() =>
    originsFor("map", { SUBAKO_EXTRA_ORIGINS: "https://example.com/path" }),
  );
});
test("ID更新でキーや他アプリの設定を保持する", () => {
  const source =
    "# settings\nSUBAKO_API_KEY=demo-secret\nSUBAKO_AGENT_EC=old\n";
  const changed = replaceEnvValue(source, "SUBAKO_AGENT_EC", "new");
  assert.ok(changed.includes("SUBAKO_API_KEY=demo-secret"));
  assert.ok(changed.includes("SUBAKO_AGENT_EC=new"));
  assert.equal(changed.match(/SUBAKO_AGENT_EC=/g).length, 1);
  assert.throws(() => replaceEnvValue(source, "X", "x\nY=z"));
});
test("providerに存在しないモデルと形式違いを拒否する", () => {
  const provider = {
    type: "platform",
    format: "anthropic",
    models: [{ model: "demo" }],
  };
  assert.equal(modelFor({ SUBAKO_MODEL_ID: "demo" }, provider).model, "demo");
  assert.throws(() => modelFor({ SUBAKO_MODEL_ID: "missing" }, provider));
  assert.throws(() =>
    modelFor(
      { SUBAKO_MODEL_ID: "demo", SUBAKO_MODEL_FORMAT: "openai_responses" },
      provider,
    ),
  );
});
test("再publishはagentを再利用し、既存Originを保持する", async () => {
  const calls = [];
  let saved = {};
  const client = {
    agents: {
      get: async () => ({}),
      create: async () => {
        calls.push("create");
        return { id: "agent" };
      },
      publishVersion: async () => {
        calls.push("publish");
        return { id: "version" };
      },
      getSecurity: async () => ({
        allowed_origins: ["https://existing.example"],
      }),
      setSecurity: async (_id, body) => {
        assert.ok(body.allowed_origins.includes("https://existing.example"));
      },
    },
  };
  const options = {
    client,
    config: { system_prompt: "first" },
    name: "demo",
    origins: ["http://localhost:5173"],
    persist: async (next) => {
      saved = next;
    },
  };
  await publishAgent({ ...options, state: saved });
  await publishAgent({ ...options, state: saved });
  assert.deepEqual(calls, ["create", "publish"]);
  await publishAgent({
    ...options,
    config: { system_prompt: "changed" },
    state: saved,
  });
  assert.deepEqual(calls, ["create", "publish", "publish"]);
});
