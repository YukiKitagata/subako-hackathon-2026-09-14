export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export interface Todo {
  id: string;
  title: string;
  done: boolean;
  metadata: Record<string, JsonValue>;
}

function isJson(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === "object" && Object.values(value).every(isJson);
}
export function parseTodos(value: unknown): Todo[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new Error("TODOは500件以内のJSON配列で指定してください。");
  const ids = new Set<string>();
  return value.map((row, i) => {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error(`${i + 1}件目の形式を確認してください。`);
    if (typeof row.id !== "string" || !row.id.trim() || ids.has(row.id))
      throw new Error(`${i + 1}件目のidが空、または重複しています。`);
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      row.title.length > 300
    )
      throw new Error(`${i + 1}件目のtitleは1〜300文字にしてください。`);
    if (typeof row.done !== "boolean")
      throw new Error(`${i + 1}件目のdoneはtrue / falseです。`);
    const metadata = row.metadata ?? {};
    if (
      !metadata ||
      typeof metadata !== "object" ||
      Array.isArray(metadata) ||
      !isJson(metadata)
    )
      throw new Error(
        `${i + 1}件目のmetadataはJSONオブジェクトにしてください。`,
      );
    ids.add(row.id);
    return {
      id: row.id,
      title: row.title.trim(),
      done: row.done,
      metadata: metadata as Record<string, JsonValue>,
    };
  });
}
export function createTodo(
  title: string,
  metadata: Record<string, JsonValue> = {},
): Todo {
  return parseTodos([{ id: crypto.randomUUID(), title, done: false, metadata }])[0];
}
export function setTodoDone(items: Todo[], id: string, done: boolean): Todo[] {
  if (typeof done !== "boolean")
    throw new Error("doneはtrue / falseで指定してください。");
  if (!items.some((item) => item.id === id))
    throw new Error(
      "指定したTODOが見つかりません。最新の一覧を確認してください。",
    );
  return items.map((item) => (item.id === id ? { ...item, done } : item));
}
