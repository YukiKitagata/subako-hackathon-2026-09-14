import { useRef, useState } from "react";
import {
  checkIds,
  getVisitSummary,
  parseMapItems,
  updateVisitOrder,
  type MapItem,
  type MapState,
} from "./domain";

const initialState = (items: MapItem[]): MapState => ({
  items,
  candidateIds: [],
  visitIds: [],
  pinnedIds: [],
  selectedId: null,
});

export function useMapApp(
  initialItems: MapItem[],
  storageKey: string,
) {
  const [loaded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return { state: initialState(initialItems), notice: "" };
      const data = JSON.parse(saved) as Record<string, unknown>;
      const items = parseMapItems(data);
      const candidateIds = checkIds(items, data.candidateIds ?? []);
      const visitIds = checkIds(items, data.visitIds ?? []);
      const pinnedIds = checkIds(items, data.pinnedIds ?? []).filter((id) =>
        visitIds.includes(id),
      );
      return {
        state: { ...initialState(items), candidateIds, visitIds, pinnedIds },
        notice: "",
      };
    } catch {
      return {
        state: initialState(initialItems),
        notice: "保存データを読み込めなかったため、初期データを表示しました。",
      };
    }
  });
  const [state, setState] = useState<MapState>(loaded.state);
  const [notice, setNotice] = useState(loaded.notice);
  const current = useRef(state);
  current.current = state;

  function commit(next: MapState) {
    // 続けて操作されても、最新の状態を使います。
    current.current = next;
    setState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setNotice(
        "ブラウザーに保存できませんでした。再読み込みすると今回の変更が失われる場合があります。",
      );
    }
    return next;
  }

  const app = {
    state,
    notice,
    setNotice,
    getState() {
      // 再描画前に続けて呼ばれても、最新の変更を返します。
      return current.current;
    },
    getVisitSummary() {
      return getVisitSummary(
        current.current.items,
        current.current.visitIds,
      );
    },
    showCandidates(ids: unknown) {
      return commit({
        ...current.current,
        candidateIds: checkIds(current.current.items, ids),
      }).candidateIds;
    },
    setVisitOrder(ids: unknown) {
      return commit(updateVisitOrder(current.current, ids));
    },
    setPinned(id: string, pinned: boolean) {
      checkIds(current.current.items, [id]);
      const next = current.current;
      return commit({
        ...next,
        visitIds:
          pinned && !next.visitIds.includes(id)
            ? [...next.visitIds, id]
            : next.visitIds,
        pinnedIds: pinned
          ? [...new Set([...next.pinnedIds, id])]
          : next.pinnedIds.filter((entry) => entry !== id),
      }).pinnedIds;
    },
    selectItem(id: string | null) {
      if (id !== null) checkIds(current.current.items, [id]);
      commit({ ...current.current, selectedId: id });
    },
  };
  return app;
}

export type MapApp = ReturnType<typeof useMapApp>;
