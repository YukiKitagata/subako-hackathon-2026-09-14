import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { parseMapItems } from "./domain";
import { useMapApp, type MapApp } from "./use-map-app";

const initialItems = parseMapItems([
  { id: "initial", name: "初期地点", position: { lat: 35.66, lng: 139.7 }, tags: [] },
]);
const savedItems = parseMapItems([
  { id: "custom-a", name: "拠点A", position: { lat: 34.71, lng: 137.72 }, tags: [] },
  { id: "custom-b", name: "拠点B", position: { lat: 34.72, lng: 137.73 }, tags: [] },
]);

function reload(saved: object, action?: (app: MapApp) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => JSON.stringify(saved),
      setItem: () => { throw new Error("保存容量が足りません"); },
    },
  });
  let app: MapApp | undefined;
  let acted = false;
  try {
    function Probe() {
      app = useMapApp(initialItems, "map-test");
      if (action && !acted) {
        acted = true;
        action(app);
      }
      return null;
    }
    renderToString(createElement(Probe));
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  assert.ok(app);
  return app;
}

test("再読込で保存した地点・候補・訪問順・固定を復元する", () => {
  const app = reload({
    items: savedItems,
    candidateIds: ["custom-b"],
    visitIds: ["custom-b", "custom-a"],
    pinnedIds: ["custom-a"],
  });
  assert.deepEqual(app.state.items, savedItems);
  assert.deepEqual(app.state.candidateIds, ["custom-b"]);
  assert.deepEqual(app.state.visitIds, ["custom-b", "custom-a"]);
  assert.deepEqual(app.state.pinnedIds, ["custom-a"]);
  assert.equal(app.notice, "");
});

test("保存済みの選択IDが壊れていたら初期化と理由の表示を一緒に行う", () => {
  for (const field of ["visitIds", "pinnedIds", "candidateIds"]) {
    const app = reload({
      items: savedItems,
      candidateIds: [],
      visitIds: [],
      pinnedIds: [],
      [field]: ["unknown"],
    });
    assert.deepEqual(app.state.items, initialItems, field);
    assert.deepEqual(app.state.visitIds, [], field);
    assert.match(app.notice, /保存データを読み込めなかった/, field);
  }
});


test("候補選択で保存に失敗しても、画面には反映して理由を表示する", () => {
  const saved = { items: savedItems, visitIds: ["custom-a"] };
  const app = reload(saved, (app) => app.showCandidates(["custom-b"]));
  assert.deepEqual(app.state.candidateIds, ["custom-b"]);
  assert.match(app.notice, /ブラウザーに保存できませんでした/);
});
