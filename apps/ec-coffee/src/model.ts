export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  tags: string[];
  // カードには表示しない、商品の補足情報。
  metadata: Record<string, JsonValue>;
}

export interface CatalogData {
  version: 1;
  title: string;
  description: string;
  items: CatalogItem[];
}

export interface CartLine {
  itemId: string;
  quantity: number;
}

export function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} はオブジェクトにしてください。`);
  }
  return value as Record<string, unknown>;
}

function onlyKeys(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
): void {
  const extra = Object.keys(value).filter((key) => !keys.includes(key));
  if (extra.length)
    throw new Error(
      `${label}: 未定義の項目 ${extra.join(", ")}。独自の情報は metadata に入れてください。`,
    );
}

export function textValue(
  value: unknown,
  label: string,
  max = 500,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim() === "") ||
    value.length > max
  ) {
    throw new Error(
      `${label} は${allowEmpty ? "0" : "1"}〜${max}文字の文字列にしてください。`,
    );
  }
  return value.trim();
}

export function integer(
  value: unknown,
  label: string,
  max = 100_000_000,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  ) {
    throw new Error(`${label} は0〜${max}の整数にしてください。`);
  }
  return value;
}

function jsonValue(value: unknown, depth = 0): JsonValue {
  if (depth > 8)
    throw new Error("metadata の入れ子は8段階までにしてください。");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return value.map((entry) => jsonValue(entry, depth + 1));
  const object = record(value, "metadata の値");
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [
      key,
      jsonValue(entry, depth + 1),
    ]),
  );
}

export function validateCatalog(input: unknown): CatalogData {
  const data = record(input, "データ全体");
  onlyKeys(data, ["version", "title", "description", "items"], "データ全体");
  if (data.version !== 1) throw new Error("version は 1 にしてください。");
  if (!Array.isArray(data.items) || data.items.length > 100)
    throw new Error("items は100件以内の配列にしてください。");
  const ids = new Set<string>();
  const items = data.items.map((inputItem, index): CatalogItem => {
    const label = `items[${index}]`;
    const item = record(inputItem, label);
    onlyKeys(
      item,
      [
        "id",
        "name",
        "description",
        "price",
        "unit",
        "stock",
        "tags",
        "metadata",
      ],
      label,
    );
    const id = textValue(item.id, `${label}.id`, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id))
      throw new Error(
        `${label}.id は半角英数字・ハイフン・アンダースコアにしてください。`,
      );
    if (ids.has(id)) throw new Error(`id「${id}」が重複しています。`);
    ids.add(id);
    const tags = item.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 12)
      throw new Error(`${label}.tags は12個以内の配列にしてください。`);
    const metadata = record(item.metadata ?? {}, `${label}.metadata`);
    return {
      id,
      name: textValue(item.name, `${label}.name`, 80),
      description: textValue(
        item.description,
        `${label}.description`,
        500,
        true,
      ),
      price: integer(item.price, `${label}.price`),
      unit: textValue(item.unit ?? "点", `${label}.unit`, 30),
      stock: integer(item.stock, `${label}.stock`, 9999),
      tags: tags.map((tag) => textValue(tag, `${label}.tags`, 30)),
      metadata: jsonValue(metadata) as Record<string, JsonValue>,
    };
  });
  return {
    version: 1,
    title: textValue(data.title, "title", 80),
    description: textValue(data.description, "description", 500, true),
    items,
  };
}

export function validateCart(input: unknown, items: CatalogItem[]): CartLine[] {
  if (!Array.isArray(input)) throw new Error("カートは配列にしてください。");
  const seen = new Set<string>();
  return input.map((entry) => {
    const line = record(entry, "カートの商品");
    const itemId = textValue(line.itemId, "itemId", 80);
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`商品「${itemId}」が見つかりません。`);
    if (seen.has(itemId))
      throw new Error(`商品「${itemId}」が重複しています。`);
    seen.add(itemId);
    const quantity = integer(line.quantity, "数量", 9999);
    if (quantity === 0) throw new Error("カートの数量は1以上にしてください。");
    if (quantity > item.stock)
      throw new Error(`${item.name} の在庫は ${item.stock} 点です。`);
    return { itemId, quantity };
  });
}

export function setCartQuantity(
  cart: CartLine[],
  items: CatalogItem[],
  itemId: string,
  quantity: number,
): CartLine[] {
  integer(quantity, "数量", 9999);
  if (!items.some((item) => item.id === itemId))
    throw new Error(`商品「${itemId}」が見つかりません。`);
  const next = cart.filter((line) => line.itemId !== itemId);
  if (quantity > 0) next.push({ itemId, quantity });
  return validateCart(next, items);
}

export function cartSummary(cart: CartLine[], items: CatalogItem[]) {
  const lines = validateCart(cart, items).map((line) => {
    const item = items.find((entry) => entry.id === line.itemId)!;
    return {
      ...line,
      name: item.name,
      price: item.price,
      unit: item.unit,
      subtotal: item.price * line.quantity,
    };
  });
  return {
    lines,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.subtotal, 0),
    currency: "JPY",
  };
}

export function validateBundle(
  lines: CartLine[],
  items: CatalogItem[],
  maxTotal?: number,
): CartLine[] {
  const cart = validateCart(lines, items);
  if (maxTotal !== undefined) {
    integer(maxTotal, "予算");
    const { total } = cartSummary(cart, items);
    if (total > maxTotal)
      throw new Error(`合計 ${total} 円は予算 ${maxTotal} 円を超えています。`);
  }
  return cart;
}

export function searchCatalog(
  items: CatalogItem[],
  query = "",
  maxPrice?: number,
): CatalogItem[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    // 補足情報も含めて検索する。
    const haystack = JSON.stringify(item).toLocaleLowerCase();
    return (
      words.every((word) => haystack.includes(word)) &&
      (maxPrice === undefined || item.price <= maxPrice)
    );
  });
}
