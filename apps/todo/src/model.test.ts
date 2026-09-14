import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMenu,
  describeWorkout,
  itemSeconds,
  parseExercises,
  parseWorkout,
  setItemDone,
  type Exercise,
  type MenuItem,
} from "./model";
import data from "./data.json";

const exercises: Exercise[] = parseExercises([
  { id: "press", name: "チェストプレス", category: "machine", muscle: "胸", targets: ["大胸筋"], sets: 3, repsMin: 8, repsMax: 10, restSec: 60, secPerRep: 3, setupSec: 30 },
  { id: "curl", name: "ダンベルカール", category: "free_weight", muscle: "腕", targets: ["上腕二頭筋"], sets: 2, repsMin: 10, repsMax: 12, restSec: 30, secPerRep: 2, setupSec: 0, metadata: { level: "初級" } },
  { id: "bike", name: "エアロバイク", category: "cardio", muscle: "心肺", targets: ["心肺機能"], minutesMin: 5, minutesMax: 20, setupSec: 30, intensity: "ややきつい" },
]);
const workout = (availableMinutes: number | null, travelSec = 0, items: MenuItem[] = []) => ({ availableMinutes, travelSec, items });

test("マスターデータを読み込み、不正な種目を拒否する", () => {
  const master = parseExercises(data);
  assert.ok(master.some((exercise) => exercise.category === "cardio"));
  assert.ok(master.some((exercise) => exercise.category !== "cardio"));
  assert.deepEqual(exercises[1].metadata, { level: "初級" });
  const row = { id: "a", name: "A", category: "machine", muscle: "脚", targets: ["大腿四頭筋"], sets: 3, repsMin: 8, repsMax: 12, restSec: 60, secPerRep: 3, setupSec: 30 };
  assert.throws(() => parseExercises([row, row]), /重複/);
  assert.throws(() => parseExercises([{ ...row, targets: [] }]), /targets/);
  assert.throws(() => parseExercises([{ ...row, category: "yoga" }]), /category/);
  assert.throws(() => parseExercises([{ ...row, repsMin: 13 }]), /REP数/);
  const cardio = { id: "b", name: "B", category: "cardio", muscle: "心肺", targets: ["心肺機能"], minutesMin: 5, minutesMax: 20, setupSec: 30, intensity: "ややきつい" };
  assert.throws(() => parseExercises([{ ...cardio, minutesMin: 30 }]), /実施時間/);
  assert.throws(() => parseExercises([{ ...cardio, intensity: " " }]), /intensity/);
});

test("所要時間は、筋トレは準備・REP・インターバル、有酸素は準備と実施時間の合計", () => {
  // 30 + 3×10×3 + 2×60
  assert.equal(itemSeconds(exercises[0], { kind: "strength", exerciseId: "press", sets: 3, reps: 10, restSec: 60, done: false }), 240);
  // 30 + 12×60
  assert.equal(itemSeconds(exercises[2], { kind: "cardio", exerciseId: "bike", minutes: 12, done: false }), 750);
});

test("省略した値はマスターの標準値で埋める", () => {
  const [press, bike] = buildMenu(exercises, [{ exerciseId: "press" }, { exerciseId: "bike" }], workout(20));
  assert.deepEqual(press, { kind: "strength", exerciseId: "press", sets: 3, reps: 10, restSec: 60, done: false });
  assert.deepEqual(bike, { kind: "cardio", exerciseId: "bike", minutes: 5, done: false });
});

test("有酸素はminutesだけ、筋トレはsets・reps・restSecで指定する", () => {
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "bike", sets: 2 }], workout(30)), /minutesだけ/);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "press", minutes: 5 }], workout(30)), /sets・reps・restSec/);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "bike", minutes: 61 }], workout(90)), /1〜60分/);
  const summary = describeWorkout(exercises, workout(30, 0, buildMenu(exercises, [{ exerciseId: "bike", minutes: 10 }], workout(30))));
  const [bike] = summary.items;
  assert.equal(bike.category, "cardio");
  assert.ok(bike.category === "cardio" && bike.intensity === "ややきつい" && bike.minutes === 10);
  assert.equal(summary.trainingSeconds, 630);
});

test("kindが種目の種類と合わなければ、正しい指定方法を返す", () => {
  assert.throws(() => buildMenu(exercises, [{ kind: "cardio", exerciseId: "press", minutes: 5 }], workout(30)), /筋トレ種目なので、kind: "strength"/);
  assert.throws(() => buildMenu(exercises, [{ kind: "strength", exerciseId: "bike", sets: 3, reps: 10, restSec: 60 }], workout(30)), /有酸素種目なので、kind: "cardio"/);
  const items = buildMenu(exercises, [
    { kind: "strength", exerciseId: "press", sets: 2, reps: 8, restSec: 90 },
    { kind: "cardio", exerciseId: "bike", minutes: 6 },
  ], workout(30));
  assert.deepEqual(items.map((item) => item.kind), ["strength", "cardio"]);
});

test("スキマ時間ちょうどは許可し、超えると拒否する", () => {
  // press 240秒 + curl 2×12×2 + 30 = 78秒 → 318秒
  const entries = [{ exerciseId: "press" }, { exerciseId: "curl" }];
  assert.equal(describeWorkout(exercises, workout(6, 0, buildMenu(exercises, entries, workout(6)))).totalSeconds, 318);
  assert.throws(() => buildMenu(exercises, entries, workout(5)), /5分を18秒超えています/);
  assert.doesNotThrow(() => buildMenu(exercises, [{ exerciseId: "press", sets: 2 }, { exerciseId: "curl" }], workout(5)));
});

test("往復の移動時間もスキマ時間に含める", () => {
  // 移動 282秒 + トレーニング 318秒 = 600秒 = 10分
  const entries = [{ exerciseId: "press" }, { exerciseId: "curl" }];
  const summary = describeWorkout(exercises, workout(10, 282, buildMenu(exercises, entries, workout(10, 282))));
  assert.deepEqual([summary.travelSeconds, summary.trainingSeconds, summary.totalSeconds, summary.remainingSeconds], [282, 318, 600, 0]);
  assert.throws(() => buildMenu(exercises, entries, workout(10, 283)), /往復の移動4分43秒とトレーニング5分18秒で、合計10分1秒となり、スキマ時間10分を1秒超えています/);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "curl" }], workout(10, 600)), /移動10分だけでスキマ時間10分に収まりません/);
});

test("不明な種目・重複・範囲外の値を拒否する", () => {
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "missing" }], workout(30)), /マスターにありません/);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "press" }, { exerciseId: "press" }], workout(30)), /重複/);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "press", reps: 0 }], workout(30)), /REP数は1〜30/);
});

test("メニューを更新しても完了済みの種目は完了のまま", () => {
  const first = setItemDone(buildMenu(exercises, [{ exerciseId: "press" }, { exerciseId: "bike" }], workout(30)), "bike", true);
  const next = buildMenu(exercises, [{ exerciseId: "bike", minutes: 8 }, { exerciseId: "press", sets: 2 }], workout(30, 0, first));
  assert.deepEqual(next.map((item) => item.done), [true, false]);
  assert.throws(() => setItemDone(next, "missing", true), /メニューにありません/);
});

test("スキマ時間が未設定なら残り時間を出さず、メニューも作らない", () => {
  assert.equal(describeWorkout(exercises, workout(null)).remainingSeconds, null);
  assert.throws(() => buildMenu(exercises, [{ exerciseId: "curl" }], workout(null)), /スキマ時間が未設定/);
});

test("保存データからメニューだけを読み戻し、スキマ時間と移動時間は未設定に戻す", () => {
  const items = buildMenu(exercises, [{ exerciseId: "curl" }, { exerciseId: "bike", minutes: 7 }], workout(30));
  const saved = { availableMinutes: 15, travelSec: 300, items };
  assert.deepEqual(parseWorkout(exercises, JSON.parse(JSON.stringify(saved))), workout(null, 0, items));
  assert.throws(() => parseWorkout(exercises, { items: "curl" }), /20種目以内/);
});
