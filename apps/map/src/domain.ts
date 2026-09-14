export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface MapItem {
  id: string;
  name: string;
  description: string;
  address: string;
  position: { lat: number; lng: number };
  tags: string[];
  url?: string;
  // 画面に表示しない補足情報を保存できます。
  metadata: Record<string, JsonValue>;
}

export interface MapState {
  items: MapItem[];
  candidateIds: string[];
  visitIds: string[];
  pinnedIds: string[];
  selectedId: string | null;
}

export const SHIBUYA_STATION = { lat: 35.658034, lng: 139.701636 };

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}はオブジェクトにしてください。`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, required = false): string {
  if (typeof value !== "string" || (required && !value.trim()))
    throw new Error(
      `${label}は${required ? "空でない" : ""}文字列にしてください。`,
    );
  if (value.length > 4000)
    throw new Error(`${label}が長すぎます（最大4,000文字）。`);
  return value;
}

function jsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 10) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((item) => jsonValue(item, depth + 1));
  if (typeof value === "object")
    return Object.values(value).every((item) => jsonValue(item, depth + 1));
  return false;
}

export function parseMapItems(value: unknown): MapItem[] {
  const rows = Array.isArray(value) ? value : record(value, "データ").items;
  if (!Array.isArray(rows))
    throw new Error("items配列、または配列そのものを読み込んでください。");
  if (rows.length > 200) throw new Error("地点は200件以内にしてください。");
  const seen = new Set<string>();
  return rows.map((row: unknown, index: number) => {
    const label = `${index + 1}件目`;
    const item = record(row, label);
    const id = string(item.id, `${label}のid`, true);
    if (seen.has(id)) throw new Error(`id「${id}」が重複しています。`);
    seen.add(id);
    const position = record(item.position, `${label}のposition`);
    if (
      typeof position.lat !== "number" ||
      !Number.isFinite(position.lat) ||
      position.lat < -90 ||
      position.lat > 90
    )
      throw new Error(`${label}の緯度は-90〜90の数値にしてください。`);
    if (
      typeof position.lng !== "number" ||
      !Number.isFinite(position.lng) ||
      position.lng < -180 ||
      position.lng > 180
    )
      throw new Error(`${label}の経度は-180〜180の数値にしてください。`);
    if (
      !Array.isArray(item.tags) ||
      !item.tags.every((tag) => typeof tag === "string")
    )
      throw new Error(`${label}のtagsは文字列の配列にしてください。`);
    const metadata = record(item.metadata ?? {}, `${label}のmetadata`);
    if (!jsonValue(metadata))
      throw new Error(`${label}のmetadataは10階層以内のJSON値にしてください。`);
    let url: string | undefined;
    if (item.url !== undefined && item.url !== "") {
      url = string(item.url, `${label}のurl`);
      try {
        if (!["https:", "http:"].includes(new URL(url).protocol))
          throw new Error();
      } catch {
        throw new Error(`${label}のurlはhttp/https URLにしてください。`);
      }
    }
    return {
      id,
      name: string(item.name, `${label}のname`, true),
      description: string(item.description ?? "", `${label}のdescription`),
      address: string(item.address ?? "", `${label}のaddress`),
      position: { lat: position.lat, lng: position.lng },
      tags: item.tags,
      ...(url ? { url } : {}),
      metadata: metadata as Record<string, JsonValue>,
    };
  });
}

export function checkIds(items: MapItem[], value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string"))
    throw new Error("idsは文字列の配列にしてください。");
  const known = new Set(items.map((item) => item.id));
  if (new Set(value).size !== value.length)
    throw new Error("同じ地点を2回指定することはできません。");
  const unknown = value.filter((id) => !known.has(id));
  if (unknown.length)
    throw new Error(`存在しない地点です: ${unknown.join(", ")}`);
  return value;
}

export function updateVisitOrder(state: MapState, ids: unknown): MapState {
  const visitIds = checkIds(state.items, ids);
  const removed = state.pinnedIds.filter((id) => !visitIds.includes(id));
  if (removed.length)
    throw new Error(
      `固定した地点は外せません。先に固定を解除してください: ${removed.join(", ")}`,
    );
  return { ...state, visitIds };
}

export function distanceKm(
  from: MapItem["position"],
  to: MapItem["position"],
): number {
  const radians = (n: number) => (n * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function getVisitSummary(
  items: MapItem[],
  ids: string[],
) {
  const locations = ids.flatMap(
    (id) => items.find((item) => item.id === id) ?? [],
  );
  const segments = locations.map((item, index) => {
    const previous = locations[index - 1];
    const from = previous?.position ?? SHIBUYA_STATION;
    const straightLineKm = distanceKm(from, item.position);
    return {
      from: previous?.name ?? "渋谷駅",
      to: item.name,
      distanceKm: straightLineKm,
      estimatedWalkMinutes: Math.max(
        1,
        Math.ceil(((straightLineKm * 1.3) / 4.8) * 60),
      ),
      coordinates: [
        [from.lng, from.lat],
        [item.position.lng, item.position.lat],
      ],
    };
  });
  return {
    segments,
    estimatedWalkMinutes: segments.reduce(
      (sum, item) => sum + item.estimatedWalkMinutes,
      0,
    ),
    note: "点線は訪問順で、徒歩経路ではありません。直線距離×1.3・時速4.8kmで概算しています。滞在時間と帰路は含みません。",
  };
}
