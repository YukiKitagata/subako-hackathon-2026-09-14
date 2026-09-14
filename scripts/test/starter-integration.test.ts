import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { uncommentStarter } from "./support/uncomment-starter";

for (const app of ["ec", "map"]) {
  test(`${app}: 手順のコメント解除だけでSDK連携を型チェックできる`, () => {
    const configPath = fileURLToPath(new URL(`../../apps/${app}/tsconfig.json`, import.meta.url));
    const appPath = fileURLToPath(new URL(`../../apps/${app}/src/App.tsx`, import.meta.url));
    const source = readFileSync(appPath, "utf8");
    assert.deepEqual([...source.matchAll(/TODO\((\d+)\)/g)].map((match) => match[1]), ["1", "2", "3", "4", "5", "6"]);
    const enabled = uncommentStarter(source);
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
    assert.deepEqual(tools, app === "ec" ? [
      "search_items", "get_item", "show_items", "show_all_items", "compare_items",
      "get_cart", "set_cart_quantity", "replace_cart", "open_checkout",
    ] : ["get_places", "get_map_state", "show_candidates", "set_visit_order", "set_pinned"]);
  });
}
