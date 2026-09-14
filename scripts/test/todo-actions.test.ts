import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Todo } from "../../apps/todo/src/model";

type Actions = {
  getItems: () => Todo[];
  add: (title: string) => Todo;
  complete: (id: string, done: boolean) => Todo;
  remove: (id: string) => void;
};

function readApp(app: string) {
  const url = new URL(`../../apps/${app}/src/App.tsx`, import.meta.url);
  return ts.createSourceFile(url.pathname, readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

// 本体の状態・操作を実Reactで動かし、画面と通信だけを省きます。
async function harness(app: string) {
  const source = readApp(app);
  const component = source.statements.find(
    (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "App",
  );
  assert.ok(component?.body);
  const statements = component.body.statements;
  const start = statements.findIndex((node) => ts.isVariableStatement(node)
    && node.declarationList.declarations.some((declaration) => declaration.name.getText(source) === "[initial]"));
  const end = statements.findIndex(ts.isReturnStatement);
  assert.ok(start >= 0 && end > start, `${app}: Appの状態初期化とreturnを確認してください。`);
  const body = statements.slice(start, end).map((node) => node.getText(source)).join("\n");
  const model = await import(new URL(`../../apps/${app}/src/model.ts`, import.meta.url).href);
  const data = JSON.parse(readFileSync(new URL(`../../apps/${app}/src/data.json`, import.meta.url), "utf8"));
  const initialItems: Todo[] = model.parseTodos(data);
  const program = ts.transpileModule(`
    return function Probe() {
      ${body}
      const [tested, setTested] = useState(false);
      observe(items);
      if (!tested) {
        scenario({
          getItems: typeof getItems === "function" ? getItems : () => items,
          add, complete, remove,
        }, items);
        setTested(true);
      }
      return null;
    };
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const createProbe = new Function(
    "useState", "useRef", "useEffect", "createTodo", "parseTodos", "setTodoDone",
    "useSessionId", "sessionStorageKey",
    "data", "initialItems", "storageKey", "localStorage", "scenario", "observe", program,
  );

  return {
    initialItems,
    run(seed: Todo[], scenario: (actions: Actions, snapshot: Todo[]) => void) {
      let renderedItems: Todo[] = [];
      const Probe = createProbe(
        useState, useRef, useEffect, model.createTodo, model.parseTodos, model.setTodoDone,
        () => ({ sessionId: "test-session", creating: false, error: "", startNew() {} }), "test-session-key",
        data, initialItems, "test-todos", { getItem: () => JSON.stringify(seed) },
        scenario, (items: Todo[]) => { renderedItems = items; },
      );
      // 同じ描画の関数を連続で呼び、まとめて反映されたstateを確認します。
      renderToStaticMarkup(createElement(Probe));
      return { items: renderedItems };
    },
  };
}

function listTool() {
  const source = readApp("todo-integrated");
  let execute: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useTool"
      && ts.isStringLiteral(node.arguments[1]) && node.arguments[1].text === "list_todos") {
      const options = node.arguments[2];
      assert.ok(ts.isObjectLiteralExpression(options));
      const property = options.properties.find((entry) => entry.name?.getText(source) === "execute");
      assert.ok(property && ts.isPropertyAssignment(property));
      execute = property.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(execute);
  return new Function("items", "getItems", `return (${execute.getText(source)});`);
}

const fixture = (count: number): Todo[] => Array.from({ length: count }, (_, index) => ({
  id: `todo-${index}`, title: `TODO ${index}`, done: false, metadata: {},
}));

for (const app of ["todo", "todo-integrated"]) {
  const subject = await harness(app);

  test(`${app}: 連続追加の結果を即座に取得できる`, () => {
    const result = subject.run([], (actions) => {
      const first = actions.add("ひとつ目");
      const second = actions.add("ふたつ目");
      assert.deepEqual(actions.getItems().map((item) => item.id), [first.id, second.id]);
    });
    assert.equal(result.items.length, 2);
  });

  test(`${app}: 499件から連続追加しても500件を超えない`, () => {
    const result = subject.run(fixture(499), (actions) => {
      actions.add("最後の1件");
      assert.throws(() => actions.add("上限を超える1件"), /500件/);
      assert.equal(actions.getItems().length, 500);
    });
    assert.equal(result.items.length, 500);
  });

  test(`${app}: 追加直後の完了と削除直後の検証に最新状態を使う`, () => {
    const result = subject.run([], (actions) => {
      const added = actions.add("追加直後に完了");
      assert.equal(actions.complete(added.id, true).done, true);
      assert.equal(actions.getItems()[0].done, true);
      actions.remove(added.id);
      assert.throws(() => actions.complete(added.id, false), /見つかりません/);
      assert.deepEqual(actions.getItems(), []);
    });
    assert.deepEqual(result.items, []);
  });


}

test("list_todosは再描画を待たずに最新の変更を返す", async () => {
  const subject = await harness("todo-integrated");
  const createList = listTool();
  subject.run([], (actions, snapshot) => {
    const execute = createList(snapshot, actions.getItems);
    const added = actions.add("会話から追加");
    assert.deepEqual(JSON.parse(execute()), [added]);
    actions.complete(added.id, true);
    assert.equal(JSON.parse(execute())[0].done, true);
  });
});
