export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type Category = "machine" | "free_weight" | "cardio";
export const categoryLabels: Record<Category, string> = {
  machine: "マシン",
  free_weight: "フリーウェイト",
  cardio: "有酸素",
};
interface ExerciseBase {
  id: string;
  name: string;
  muscle: string;
  targets: string[];
  setupSec: number;
  metadata: Record<string, JsonValue>;
}
/** セット・レップ・インターバルで行う筋トレ種目。 */
export interface StrengthExercise extends ExerciseBase {
  category: "machine" | "free_weight";
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  secPerRep: number;
}
/** 時間で行う有酸素種目。 */
export interface CardioExercise extends ExerciseBase {
  category: "cardio";
  minutesMin: number;
  minutesMax: number;
  intensity: string;
}
export type Exercise = StrengthExercise | CardioExercise;

export type MenuItem =
  | { kind: "strength"; exerciseId: string; sets: number; reps: number; restSec: number; done: boolean }
  | { kind: "cardio"; exerciseId: string; minutes: number; done: boolean };
export interface MenuEntry {
  kind?: MenuItem["kind"];
  exerciseId: string;
  sets?: number;
  reps?: number;
  restSec?: number;
  minutes?: number;
}
export interface Workout {
  /** ジムまでの往復を含めたスキマ時間（分）。ユーザーから聞いて設定するまでは null。 */
  availableMinutes: number | null;
  /** ジムまでの往復の移動秒数。ジムを選んでいなければ0。 */
  travelSec: number;
  items: MenuItem[];
}

const limits = {
  minutes: [1, 180],
  sets: [1, 6],
  reps: [1, 30],
  restSec: [0, 300],
  cardioMinutes: [1, 60],
} as const;

function isInt(value: unknown, [min, max]: readonly [number, number]): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}
function isJson(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === "object" && Object.values(value).every(isJson);
}

export function parseExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("種目は1件以上のJSON配列で指定してください。");
  const ids = new Set<string>();
  return value.map((row, i): Exercise => {
    const at = `${i + 1}件目`;
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error(`${at}の形式を確認してください。`);
    if (typeof row.id !== "string" || !row.id.trim() || ids.has(row.id))
      throw new Error(`${at}のidが空、または重複しています。`);
    if (typeof row.name !== "string" || !row.name.trim() || typeof row.muscle !== "string" || !row.muscle.trim())
      throw new Error(`${at}のname・muscleを入力してください。`);
    if (
      !Array.isArray(row.targets) ||
      !row.targets.length ||
      row.targets.length > 5 ||
      !row.targets.every((target: unknown) => typeof target === "string" && target.trim())
    )
      throw new Error(`${at}のtargetsは1〜5件の筋肉名にしてください。`);
    if (!Object.hasOwn(categoryLabels, row.category))
      throw new Error(`${at}のcategoryはmachine / free_weight / cardioです。`);
    if (!isInt(row.setupSec, [0, 600]))
      throw new Error(`${at}のsetupSecは0〜600秒にしてください。`);
    const metadata = row.metadata ?? {};
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !isJson(metadata))
      throw new Error(`${at}のmetadataはJSONオブジェクトにしてください。`);
    ids.add(row.id);
    const base = {
      id: row.id,
      name: row.name.trim(),
      muscle: row.muscle.trim(),
      targets: row.targets.map((target: string) => target.trim()),
      setupSec: row.setupSec,
      metadata: metadata as Record<string, JsonValue>,
    };
    if (row.category === "cardio") {
      if (
        !isInt(row.minutesMin, limits.cardioMinutes) ||
        !isInt(row.minutesMax, limits.cardioMinutes) ||
        row.minutesMin > row.minutesMax
      )
        throw new Error(`${at}の実施時間（minutesMin・minutesMax）を確認してください。`);
      if (typeof row.intensity !== "string" || !row.intensity.trim())
        throw new Error(`${at}のintensityに強度の目安を入力してください。`);
      return {
        ...base,
        category: "cardio",
        minutesMin: row.minutesMin,
        minutesMax: row.minutesMax,
        intensity: row.intensity.trim(),
      };
    }
    if (
      !isInt(row.sets, limits.sets) ||
      !isInt(row.repsMin, limits.reps) ||
      !isInt(row.repsMax, limits.reps) ||
      row.repsMin > row.repsMax ||
      !isInt(row.restSec, limits.restSec)
    )
      throw new Error(`${at}のセット数・REP数・インターバルを確認してください。`);
    if (!isInt(row.secPerRep, [1, 20]))
      throw new Error(`${at}のsecPerRepを確認してください。`);
    return {
      ...base,
      category: row.category,
      sets: row.sets,
      repsMin: row.repsMin,
      repsMax: row.repsMax,
      restSec: row.restSec,
      secPerRep: row.secPerRep,
    };
  });
}

/** マスターの標準値で1種目を行う場合の内容。REP数は上限、有酸素の時間は下限を使います。 */
export function standardItem(exercise: Exercise): MenuItem {
  if (exercise.category === "cardio")
    return { kind: "cardio", exerciseId: exercise.id, minutes: exercise.minutesMin, done: false };
  return {
    kind: "strength",
    exerciseId: exercise.id,
    sets: exercise.sets,
    reps: exercise.repsMax,
    restSec: exercise.restSec,
    done: false,
  };
}

/**
 * 1種目の所要秒数。
 * 筋トレ = 準備 + セット数×REP数×1REPの秒数 + セット間のインターバル、有酸素 = 準備 + 実施分数×60
 */
export function itemSeconds(exercise: Exercise, item: MenuItem) {
  if (item.kind === "cardio" && exercise.category === "cardio")
    return exercise.setupSec + item.minutes * 60;
  if (item.kind === "strength" && exercise.category !== "cardio")
    return exercise.setupSec + item.sets * item.reps * exercise.secPerRep + (item.sets - 1) * item.restSec;
  throw new Error(`「${exercise.name}」の指定方法が種目の種類と合っていません。`);
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m && s) return `${m}分${s}秒`;
  return m ? `${m}分` : `${s}秒`;
}

export function parseMinutes(value: unknown): number {
  if (!isInt(value, limits.minutes))
    throw new Error("スキマ時間は1〜180分の整数で指定してください。");
  return value;
}

function findExercise(exercises: Exercise[], id: unknown) {
  const exercise = exercises.find((entry) => entry.id === id);
  if (!exercise)
    throw new Error(`種目「${String(id)}」はマスターにありません。種目一覧のidを使ってください。`);
  return exercise;
}

function toItems(exercises: Exercise[], entries: unknown): MenuItem[] {
  if (!Array.isArray(entries) || entries.length > 20)
    throw new Error("メニューは20種目以内の配列で指定してください。");
  const seen = new Set<string>();
  return entries.map((entry): MenuItem => {
    const exercise = findExercise(exercises, entry?.exerciseId);
    if (seen.has(exercise.id)) throw new Error(`「${exercise.name}」が重複しています。`);
    seen.add(exercise.id);
    const done = entry.done ?? false;
    if (typeof done !== "boolean") throw new Error(`「${exercise.name}」のdoneはtrue / falseです。`);
    const standard = standardItem(exercise);
    if (entry.kind !== undefined && entry.kind !== standard.kind)
      throw new Error(
        standard.kind === "cardio"
          ? `「${exercise.name}」は有酸素種目なので、kind: "cardio" と minutes で指定してください。`
          : `「${exercise.name}」は筋トレ種目なので、kind: "strength" と sets・reps・restSec で指定してください。`,
      );
    if (standard.kind === "cardio") {
      if (entry.sets !== undefined || entry.reps !== undefined || entry.restSec !== undefined)
        throw new Error(`「${exercise.name}」は有酸素種目なので、minutesだけを指定してください。`);
      const minutes = entry.minutes ?? standard.minutes;
      if (!isInt(minutes, limits.cardioMinutes))
        throw new Error(`「${exercise.name}」の実施時間は1〜60分で指定してください。`);
      return { ...standard, minutes, done };
    }
    if (entry.minutes !== undefined)
      throw new Error(`「${exercise.name}」は筋トレ種目なので、minutesではなくsets・reps・restSecで指定してください。`);
    const item = {
      ...standard,
      sets: entry.sets ?? standard.sets,
      reps: entry.reps ?? standard.reps,
      restSec: entry.restSec ?? standard.restSec,
      done,
    };
    if (!isInt(item.sets, limits.sets) || !isInt(item.reps, limits.reps) || !isInt(item.restSec, limits.restSec))
      throw new Error(`「${exercise.name}」のセット数は1〜6、REP数は1〜30、インターバルは0〜300秒で指定してください。`);
    return item;
  });
}

export function totalSeconds(exercises: Exercise[], items: MenuItem[]) {
  return items.reduce((sum, item) => sum + itemSeconds(findExercise(exercises, item.exerciseId), item), 0);
}

/**
 * 往復の移動を含めてスキマ時間に収まるメニューを作ります。超える場合は例外にして、画面を変えません。
 * 省略した値はマスターの標準値を使い、完了済みの種目は完了状態を引き継ぎます。
 */
export function buildMenu(exercises: Exercise[], entries: MenuEntry[], workout: Workout): MenuItem[] {
  const items = toItems(exercises, entries).map((item) => ({
    ...item,
    done: workout.items.some((entry) => entry.exerciseId === item.exerciseId && entry.done),
  }));
  if (workout.availableMinutes === null)
    throw new Error("スキマ時間が未設定です。先にスキマ時間を確認して設定してください。");
  const minutes = parseMinutes(workout.availableMinutes);
  const limit = minutes * 60;
  const travel = workout.travelSec;
  if (travel >= limit)
    throw new Error(
      `往復の移動${formatDuration(travel)}だけでスキマ時間${minutes}分に収まりません。別のジムか、スキマ時間を見直してください。`,
    );
  const training = totalSeconds(exercises, items);
  const total = travel + training;
  if (total > limit)
    throw new Error(
      `${travel ? `往復の移動${formatDuration(travel)}とトレーニング${formatDuration(training)}で、` : ""}合計${formatDuration(total)}となり、スキマ時間${minutes}分を${formatDuration(total - limit)}超えています。種目・セット数・インターバル・有酸素の時間を減らしてください。`,
    );
  return items;
}

/** 保存データからメニューを読み戻します。スキマ時間と移動時間はその場ごとに決まるので、未設定に戻します。 */
export function parseWorkout(exercises: Exercise[], value: unknown): Workout {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("保存データの形式を確認してください。");
  const row = value as Record<string, unknown>;
  return { availableMinutes: null, travelSec: 0, items: toItems(exercises, row.items) };
}

export function setItemDone(items: MenuItem[], exerciseId: string, done: boolean): MenuItem[] {
  if (typeof done !== "boolean")
    throw new Error("doneはtrue / falseで指定してください。");
  if (!items.some((item) => item.exerciseId === exerciseId))
    throw new Error("指定した種目がメニューにありません。最新のメニューを確認してください。");
  return items.map((item) => (item.exerciseId === exerciseId ? { ...item, done } : item));
}

/** 画面とアシスタントが共通で使う、種目名と所要時間を付けたメニュー。 */
export function describeWorkout(exercises: Exercise[], workout: Workout) {
  const training = totalSeconds(exercises, workout.items);
  const total = workout.travelSec + training;
  return {
    availableMinutes: workout.availableMinutes,
    travelSeconds: workout.travelSec,
    trainingSeconds: training,
    totalSeconds: total,
    remainingSeconds: workout.availableMinutes === null ? null : workout.availableMinutes * 60 - total,
    items: workout.items.map((item) => {
      const exercise = findExercise(exercises, item.exerciseId);
      const common = {
        name: exercise.name,
        muscle: exercise.muscle,
        targets: exercise.targets,
        setupSec: exercise.setupSec,
        seconds: itemSeconds(exercise, item),
      };
      if (item.kind === "cardio" && exercise.category === "cardio")
        return {
          ...item,
          ...common,
          category: exercise.category,
          minutesMin: exercise.minutesMin,
          minutesMax: exercise.minutesMax,
          intensity: exercise.intensity,
        };
      if (item.kind === "strength" && exercise.category !== "cardio")
        return {
          ...item,
          ...common,
          category: exercise.category,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
          setSec: item.reps * exercise.secPerRep,
        };
      throw new Error(`「${exercise.name}」の指定方法が種目の種類と合っていません。`);
    }),
  };
}
