import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as todoModel from "../../apps/todo/src/model";
import { uncommentStarter } from "./support/uncomment-starter";

test("todo: SDKなしで読み込め、会話の代わりに案内を表示する", () => {
  const source = readFileSync(new URL("../../apps/todo/src/App.tsx", import.meta.url), "utf8");
  const modules: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "./model": todoModel,
    "./data.json": JSON.parse(readFileSync(new URL("../../apps/todo/src/data.json", import.meta.url), "utf8")),
    "./style.css": {},
    "./layout.css": {},
    "./session.css": {},
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as { default: React.ComponentType } };
  new Function("require", "module", "exports", "localStorage", compiled)(
    (name: string) => {
      assert.ok(Object.hasOwn(modules, name), `未連携のTODOが ${name} を読み込んでいます`);
      return modules[name];
    },
    module, module.exports, { getItem: () => null },
  );
  const html = renderToStaticMarkup(React.createElement(module.exports.default));
  assert.match(html, /ここに会話が入ります。/);
  assert.match(html, /新しいTODO/);
  assert.doesNotMatch(html, /新しいセッション|会話を準備しています/);
});

for (const app of ["todo", "ec", "map"]) {
  const steps = app === "todo" ? "コメント解除と完了ツールの追加" : "手順のコメント解除だけ";
  test(`${app}: ${steps}でSDK連携を型チェックできる`, () => {
    const configPath = fileURLToPath(new URL(`../../apps/${app}/tsconfig.json`, import.meta.url));
    const appPath = fileURLToPath(new URL(`../../apps/${app}/src/App.tsx`, import.meta.url));
    const source = readFileSync(appPath, "utf8");
    assert.deepEqual([...source.matchAll(/TODO\((\d+)\)/g)].map((match) => match[1]), ["1", "2", "3", "4", "5", "6"]);
    let enabled = uncommentStarter(source);
    if (app === "todo") {
      assert.doesNotMatch(enabled, /useTool\(client, ["']set_todo_done["']/);
      // スライドの手順4と同じ解答を、参加者の作業として追加します。
      enabled = enabled.replace("// TODO(4)", `
        useTool(client, "set_todo_done", {
          description: "一覧で取得したidのTODOを完了・未完了にする。",
          schema: z.object({ id: z.string(), done: z.boolean() }).strict(),
          execute: ({ id, done }) => JSON.stringify(complete(id, done)),
        });
        // TODO(4)`);
    }
    const host = ts.createCompilerHost({});
    const originalReadFile = host.readFile.bind(host);
    host.readFile = (name) => name === appPath ? enabled : originalReadFile(name);
    const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => assert.fail("tsconfigを読めません"),
    });
    assert.ok(parsed);
    const program = ts.createProgram(parsed.fileNames, parsed.options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => "\n",
    }));
    const ast = program.getSourceFile(appPath);
    assert.ok(ast);
    const tools: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "useTool") {
        const name = node.arguments[1];
        assert.ok(ts.isStringLiteral(name));
        tools.push(name.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.deepEqual(tools, app === "todo" ? ["list_todos", "add_todo", "set_todo_done"] : app === "ec" ? [
      "search_items", "get_item", "show_items", "show_all_items", "compare_items",
      "get_cart", "set_cart_quantity", "replace_cart", "open_checkout",
    ] : ["get_places", "get_map_state", "show_candidates", "set_visit_order", "set_pinned"]);
  });
}
