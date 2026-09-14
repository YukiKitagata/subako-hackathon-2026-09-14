import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { useMapApp, type MapApp } from "../../apps/map-coffee/src/use-map-app";
import {
  getVisitSummary,
  parseMapItems,
  type MapState,
  type WalkingRoute,
} from "../../apps/map-coffee/src/domain";

type Tools = {
  get_places: (args: { query: string }) => string;
  get_map_state: () => string;
  set_visit_order: (args: { ids: string[] }) => string;
  show_candidates: (args: { ids: string[] }) => string;
  set_pinned: (args: { id: string; pinned: boolean }) => string;
};

const directory = new URL("../../apps/map-coffee/src/", import.meta.url);
const initialItems = parseMapItems(JSON.parse(readFileSync(new URL("data.json", directory), "utf8")));
const walkingRoutes: WalkingRoute[] = JSON.parse(readFileSync(new URL("routes.json", directory), "utf8"));

// 実際のexecuteを使い、SDKの通信と画面描画だけを省きます。
function toolFactory() {
  const file = new URL("App.tsx", directory);
  const source = ts.createSourceFile(file.pathname, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks: Record<string, string> = {};
  let formatter: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "mapResult") {
      formatter = node.getText(source);
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useTool") {
      const name = node.arguments[1];
      const options = node.arguments[2];
      assert.ok(name && ts.isStringLiteral(name));
      assert.ok(options && ts.isObjectLiteralExpression(options));
      const execute = options.properties.find((property) => property.name?.getText(source) === "execute");
      assert.ok(execute && ts.isPropertyAssignment(execute));
      callbacks[name.text] = execute.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(formatter);
  const entries = Object.entries(callbacks).map(([name, execute]) => `${JSON.stringify(name)}: ${execute}`);
  const program = ts.transpileModule(`${formatter}\nreturn {${entries.join(",")}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function("app", "getVisitSummary", "walkingRoutes", program) as (
    app: MapApp, summary: typeof getVisitSummary, routes: WalkingRoute[],
  ) => Tools;
}

const createTools = toolFactory();

function run(scenario: (app: MapApp, tools: Tools) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let saved: string | null = null;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    },
  });
  let tested = false;
  let rendered: MapState | undefined;
  try {
    function Probe() {
      const app = useMapApp(initialItems, "map-tools-test", walkingRoutes);
      rendered = app.state;
      if (!tested) {
        tested = true;
        scenario(app, createTools(app, getVisitSummary, walkingRoutes));
      }
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  assert.ok(rendered);
  return rendered;
}

test("Mapの訪問順更新直後に、読取ツールも新しい順序と移動時間を返す", () => {
  const ids = [initialItems[1].id, initialItems[0].id];
  const rendered = run((app, tools) => {
    const updated = JSON.parse(tools.set_visit_order({ ids }));
    const state = JSON.parse(tools.get_map_state());
    assert.deepEqual(updated.visitIds, ids);
    assert.deepEqual(state.visitIds, ids);
    assert.equal(state.summary.estimatedWalkMinutes, app.getVisitSummary().estimatedWalkMinutes);
  });
  assert.deepEqual(rendered.visitIds, ids);
});

test("Mapの候補選択と固定の直後も、読取ツールは再描画を待たない", () => {
  const id = initialItems[0].id;
  run((_app, tools) => {
    tools.show_candidates({ ids: [id] });
    assert.deepEqual(JSON.parse(tools.get_map_state()).candidateIds, [id]);
    tools.set_pinned({ id, pinned: true });
    const state = JSON.parse(tools.get_map_state());
    assert.deepEqual(state.pinnedIds, [id]);
    assert.deepEqual(state.visitIds, [id]);
  });
});
