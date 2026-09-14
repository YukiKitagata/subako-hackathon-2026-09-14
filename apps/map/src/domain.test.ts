import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkIds,
  distanceKm,
  getVisitSummary,
  parseMapItems,
  updateVisitOrder,
  type MapState,
} from "./domain";

const row = {
  id: "first",
  name: "最初の地点",
  position: { lat: 35.658034, lng: 139.701636 },
  tags: [],
  metadata: { preferences: { priority: 2, notes: ["短時間"] } },
};

test("metadataを保持し、配列とitems形式の両方を読める", () => {
  assert.deepEqual(parseMapItems([row]), parseMapItems({ items: [row] }));
  assert.deepEqual(parseMapItems([row])[0]?.metadata, row.metadata);
  assert.deepEqual(parseMapItems([]), []);
});

test("重複ID、壊れた座標、危険なURLを取り込まない", () => {
  assert.throws(() => parseMapItems([row, row]), /重複/);
  assert.throws(
    () => parseMapItems([{ ...row, position: { lat: 91, lng: 1 } }]),
    /緯度/,
  );
  assert.throws(
    () => parseMapItems([{ ...row, position: { lat: 35, lng: "139" } }]),
    /経度/,
  );
  assert.throws(
    () => parseMapItems([{ ...row, url: "javascript:alert(1)" }]),
    /URL/,
  );
  assert.throws(() => parseMapItems([{ ...row, metadata: [] }]), /metadata/);
});

test("未登録の地点と重複した訪問を拒否する", () => {
  const items = parseMapItems([row]);
  assert.throws(() => checkIds(items, ["unknown"]), /存在しない/);
  assert.throws(() => checkIds(items, ["first", "first"]), /2回/);
});

test("訪問順の変更で固定した地点を外さず、並び替えはできる", () => {
  const items = parseMapItems([row, { ...row, id: "second" }]);
  const state: MapState = {
    items,
    candidateIds: [],
    visitIds: ["first", "second"],
    pinnedIds: ["first"],
    selectedId: null,
  };
  assert.throws(() => updateVisitOrder(state, ["second"]), /固定/);
  assert.deepEqual(updateVisitOrder(state, ["second", "first"]).visitIds, [
    "second",
    "first",
  ]);
  assert.deepEqual(state.visitIds, ["first", "second"]);
});

test("概算は直線距離に基づき、徒歩経路取得と区別する", () => {
  assert.equal(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19) < 0.1,
  );
  const result = getVisitSummary(parseMapItems([row]), ["first"]);
  assert.equal(result.segments[0]?.from, "渋谷駅");
  assert.match(result.note, /徒歩経路ではありません/);
  assert.equal(getVisitSummary([], []).estimatedWalkMinutes, 0);
});
