import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { z } from "zod";
import { useCatalog, type CatalogStore } from "../../apps/ec-coffee/src/useCatalog";
import { cartSummary, searchCatalog, validateCatalog } from "../../apps/ec-coffee/src/model";

type Tool = {
  schema: { parse: (input: unknown) => unknown };
  execute: (args: unknown) => string;
};

const url = new URL("../../apps/ec-coffee/src/App.tsx", import.meta.url);
const source = ts.createSourceFile(url.pathname, readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const factories = new Map<string, (catalog: CatalogStore) => Tool>();

// App本体の定義を読み、通信なしでschemaとexecuteを検証します。
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useTool") {
    const name = node.arguments[1];
    assert.ok(ts.isStringLiteral(name));
    const create = new Function("catalog", "z", "cartSummary", "searchCatalog", `return (${node.arguments[2].getText(source)});`);
    factories.set(name.text, (catalog) => create(catalog, z, cartSummary, searchCatalog));
  }
  ts.forEachChild(node, visit);
}
visit(source);

const initialData = validateCatalog({
  version: 1, title: "テスト商品", description: "",
  items: [{ id: "a", name: "商品A", description: "", price: 700, stock: 10, metadata: { material: "アルミ" } }],
});

function run(scenario: (catalog: CatalogStore, call: (name: string, args?: unknown) => any) => void) {
  let renderedState: CatalogStore["state"] | undefined;
  function Probe() {
    const catalog = useCatalog({ initialData, storageKey: "ec-read-tools-test" });
    const [tested, setTested] = useState(false);
    renderedState = catalog.state;
    if (!tested) {
      const tools = new Map([...factories].map(([name, create]) => [name, create(catalog)]));
      scenario(catalog, (name, args = {}) => {
        const tool = tools.get(name);
        assert.ok(tool, `${name}がAppで登録されていません。`);
        return JSON.parse(tool.execute(tool.schema.parse(args)));
      });
      setTested(true);
    }
    return null;
  }
  // 操作時の返却値と、次の描画のstateを両方確認します。
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => null },
  });
  try {
    renderToStaticMarkup(createElement(Probe));
  } finally {
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  assert.ok(renderedState);
  return renderedState;
}

test("EC: カート・表示・比較の変更直後に現在の状態を取得できる", () => {
  const state = run((_catalog, call) => {
    call("set_cart_quantity", { id: "a", quantity: 2 });
    assert.equal(call("get_cart").quantity, 2);
    assert.equal(call("get_cart").total, 1400);
    call("replace_cart", { lines: [{ itemId: "a", quantity: 3 }] });
    assert.equal(call("get_cart").quantity, 3);
    call("show_items", { ids: ["a"] });
    call("compare_items", { ids: ["a"] });
    assert.deepEqual(call("get_cart").shownIds, ["a"]);
    assert.deepEqual(call("get_cart").comparedIds, ["a"]);
    assert.throws(() => call("replace_cart", { lines: [{ itemId: "a", quantity: 2 }], maxTotal: 500 }), /予算/);
    assert.equal(call("get_cart").quantity, 3);
  });
  assert.deepEqual(state.cart, [{ itemId: "a", quantity: 3 }]);
  assert.deepEqual(state.shownIds, ["a"]);
  assert.deepEqual(state.comparedIds, ["a"]);
});

test("EC: 手動の購入確定直後に詳細・検索へ変更後の在庫が反映される", () => {
  const state = run((catalog, call) => {
    call("set_cart_quantity", { id: "a", quantity: 2 });
    catalog.openCheckout();
    catalog.confirmPurchase();
    assert.equal(call("get_item", { id: "a" }).stock, 8);
    assert.equal(call("search_items")[0].stock, 8);
    assert.equal(call("get_cart").quantity, 0);
  });
  assert.equal(state.data.items[0].stock, 8);
  assert.deepEqual(state.cart, []);
});
