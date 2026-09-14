import { useCallback, useEffect, useRef, useState } from "react";
import {
  cartSummary,
  searchCatalog,
  setCartQuantity,
  validateBundle,
  validateCart,
  validateCatalog,
} from "./model";
import type { CartLine, CatalogData } from "./model";

interface CatalogState {
  data: CatalogData;
  cart: CartLine[];
  comparedIds: string[];
  shownIds: string[] | null;
  query: string;
  detailId: string | null;
  checkoutOpen: boolean;
  receipt: ReturnType<typeof cartSummary> | null;
  notice: string;
}

function fresh(data: CatalogData, notice = ""): CatalogState {
  return {
    data: validateCatalog(data),
    cart: [],
    comparedIds: [],
    shownIds: null,
    query: "",
    detailId: null,
    checkoutOpen: false,
    receipt: null,
    notice,
  };
}

function restore(storageKey: string, initialData: CatalogData): CatalogState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fresh(initialData);
    const stored: unknown = JSON.parse(raw);
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("data" in stored) ||
      !("cart" in stored)
    )
      throw new Error("保存形式が異なります。");
    const data = validateCatalog(stored.data);
    return { ...fresh(data), cart: validateCart(stored.cart, data.items) };
  } catch {
    return fresh(
      initialData,
      "保存データを読み込めなかったため、初期データで開始しました。",
    );
  }
}

export function useCatalog({
  initialData,
  storageKey,
}: {
  initialData: CatalogData;
  storageKey: string;
}) {
  const [state, setState] = useState(() => restore(storageKey, initialData));
  const latest = useRef(state);
  const [storageError, setStorageError] = useState("");

  // 連続した操作でも直前の変更を参照する。
  const update = useCallback(
    (change: (current: CatalogState) => CatalogState) => {
      const next = change(latest.current);
      latest.current = next;
      setState(next);
      return next;
    },
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ data: state.data, cart: state.cart }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "ブラウザーに保存できません。再読み込みすると変更が失われます。",
      );
    }
  }, [state.data, state.cart, storageKey]);

  function requireIds(ids: string[], max = 100): string[] {
    if (ids.length > max) throw new Error(`${max}点まで選択できます。`);
    const unique = [...new Set(ids)];
    for (const id of unique) {
      if (!latest.current.data.items.some((item) => item.id === id))
        throw new Error(`商品「${id}」が見つかりません。`);
    }
    return unique;
  }

  function setQuantity(itemId: string, quantity: number) {
    const next = update((current) => ({
      ...current,
      cart: setCartQuantity(current.cart, current.data.items, itemId, quantity),
      checkoutOpen: false,
      receipt: null,
      notice: "カートを更新しました。",
    }));
    return cartSummary(next.cart, next.data.items);
  }

  function replaceCart(lines: CartLine[], maxTotal?: number) {
    const next = update((current) => {
      const cart = validateBundle(lines, current.data.items, maxTotal);
      return {
        ...current,
        cart,
        checkoutOpen: false,
        receipt: null,
        notice: cart.length ? "セットをカートに入れました。" : "カートを空にしました。",
      };
    });
    return cartSummary(next.cart, next.data.items);
  }

  function openCheckout() {
    const current = latest.current;
    const summary = cartSummary(current.cart, current.data.items);
    if (summary.lines.length === 0)
      throw new Error("カートに商品を入れてください。");
    update((snapshot) => ({ ...snapshot, checkoutOpen: true, receipt: null }));
    return summary;
  }


  function confirmPurchase() {
    update((current) => {
      if (!current.checkoutOpen)
        throw new Error("先に購入確認を開いてください。");
      const receipt = cartSummary(current.cart, current.data.items);
      if (!receipt.lines.length) throw new Error("カートが空です。");
      const quantities = new Map(
        current.cart.map((line) => [line.itemId, line.quantity]),
      );
      const items = current.data.items.map((item) => ({
        ...item,
        stock: item.stock - (quantities.get(item.id) ?? 0),
      }));
      return {
        ...current,
        data: { ...current.data, items },
        cart: [],
        checkoutOpen: false,
        receipt,
        notice: "デモの注文を受け付けました。実際の決済・配送は行われません。",
      };
    });
  }

  return {
    state,
    // 再描画前に呼ばれる処理にも、現在の状態を返します。
    getState: () => latest.current,
    storageError,
    setQuantity,
    replaceCart,
    openCheckout,
    confirmPurchase,
    search(query: string) {
      const shownIds = query.trim()
        ? searchCatalog(latest.current.data.items, query).map((item) => item.id)
        : null;
      update((current) => ({ ...current, query, shownIds }));
    },
    showItems(ids: string[] | null) {
      const shownIds = ids === null ? null : requireIds(ids);
      update((current) => ({ ...current, shownIds, query: "" }));
      return shownIds;
    },
    compareItems(ids: string[]) {
      const comparedIds = requireIds(ids, 3);
      update((current) => ({ ...current, comparedIds }));
      return comparedIds;
    },
    showDetail(id: string | null) {
      if (id !== null) requireIds([id]);
      update((current) => ({ ...current, detailId: id }));
    },
    closeCheckout() {
      update((current) => ({ ...current, checkoutOpen: false }));
    },
    dismissReceipt() {
      update((current) => ({ ...current, receipt: null }));
    },
  };
}

export type CatalogStore = ReturnType<typeof useCatalog>;
