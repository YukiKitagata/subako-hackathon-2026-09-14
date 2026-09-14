import test from "node:test";
import assert from "node:assert/strict";
import { createTodo, parseTodos, setTodoDone } from "./model";

test("空タイトルと重複IDを拒否し、メタデータを保持する", () => {
  assert.throws(() => createTodo(" "));
  const row = {
    id: "a",
    title: "準備",
    done: false,
    metadata: { reason: "発表前", priority: 2 },
  };
  assert.throws(() => parseTodos([row, row]));
  assert.deepEqual(parseTodos([row])[0].metadata, row.metadata);
});
test("指定したTODOだけ完了し、不明なIDは拒否する", () => {
  const items = [createTodo("準備"), createTodo("録画")];
  const updated = setTodoDone(items, items[1].id, true);
  assert.equal(updated[0].done, false);
  assert.equal(updated[1].done, true);
  assert.equal(items[1].done, false);
  assert.throws(() => setTodoDone(items, "missing", true));
});
