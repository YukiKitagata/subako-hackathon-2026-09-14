import assert from "node:assert/strict";
import test from "node:test";
import {
  cartSummary,
  searchCatalog,
  setCartQuantity,
  validateBundle,
  validateCart,
  validateCatalog,
} from "./model";

const catalog = validateCatalog({
  version: 1,
  title: "テスト商品",
  description: "",
  items: [
    { id: "a", name: "商品A", description: "", price: 700, stock: 10, metadata: { materials: ["アルミ"] } },
    { id: "b", name: "商品B", description: "", price: 800, stock: 10, metadata: { materials: ["アルミ", "樹脂"] } },
    { id: "c", name: "商品C", description: "", price: 1000, stock: 10 },
  ],
});

test("補足情報を保ち、metadataの素材から検索できる", () => {
  const matches = searchCatalog(catalog.items, "アルミ", 800);
  assert.equal(matches.length, 2);
  assert.ok(matches.every((item) => item.price <= 800));
  assert.ok(matches[0]!.metadata.materials);
  assert.deepEqual(validateCatalog(JSON.parse(JSON.stringify(catalog))), catalog);
});

test("負数の価格・非整数の在庫・重複ID・未定義の項目を拒否する", () => {
  const first = catalog.items[0]!;
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, price: -1 }] }), /price/);
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, stock: 1.5 }] }), /stock/);
  assert.throws(() => validateCatalog({ ...catalog, items: [first, first] }), /重複/);
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, material: "アルミ" }] }), /metadata/);
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, metadata: { invalid: Number.NaN } }] }));
});

test("数量は加算ではなく上書きで、0は削除になる", () => {
  const first = catalog.items[0]!;
  const cart = setCartQuantity([], catalog.items, first.id, 2);
  assert.deepEqual(setCartQuantity(cart, catalog.items, first.id, 2), cart);
  assert.equal(cartSummary(cart, catalog.items).total, first.price * 2);
  assert.deepEqual(setCartQuantity(cart, catalog.items, first.id, 0), []);
  assert.deepEqual(cart, [{ itemId: first.id, quantity: 2 }]);
});

test("在庫超過・不明な商品・負数の数量を拒否し、元のカートを変更しない", () => {
  const first = catalog.items[0]!;
  const cart = [{ itemId: first.id, quantity: 1 }];
  assert.throws(() => setCartQuantity(cart, catalog.items, first.id, first.stock + 1), /在庫/);
  assert.throws(() => setCartQuantity(cart, catalog.items, "missing", 1), /見つかりません/);
  assert.throws(() => setCartQuantity(cart, catalog.items, first.id, -1), /数量/);
  assert.deepEqual(cart, [{ itemId: first.id, quantity: 1 }]);
  assert.throws(() => validateCart([...cart, ...cart], catalog.items), /重複/);
});

test("セットの合計を計算し、予算オーバーは拒否する", () => {
  const lines = catalog.items.map((item) => ({ itemId: item.id, quantity: 1 }));
  assert.equal(cartSummary(validateBundle(lines, catalog.items, 2500), catalog.items).total, 2500);
  assert.throws(() => validateBundle(lines, catalog.items, 2000), /予算/);
  assert.throws(() => validateBundle(lines, catalog.items, -1), /予算/);
});

test("配列のmetadataを拒否し、深い入れ子を制限する", () => {
  const first = catalog.items[0]!;
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, metadata: [] }] }), /metadata/);
  let nested: unknown = "value";
  for (let i = 0; i < 12; i++) nested = { nested };
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...first, metadata: nested }] }), /8段階/);
});
