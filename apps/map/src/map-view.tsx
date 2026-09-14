import { useState } from "react";
import { Dialog } from "./Dialog";
import { MapCanvas } from "./map-canvas";
import type { MapApp } from "./use-map-app";

export function MapView({
  app,
  title,
  subtitle,
}: {
  app: MapApp;
  title: string;
  subtitle: string;
}) {
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = app.state.items.filter((item) =>
    [item.name, item.description, item.address, ...item.tags]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const selected = app.state.items.find(
    (item) => item.id === app.state.selectedId,
  );
  const visitItems = app.state.visitIds.flatMap(
    (id) => app.state.items.find((item) => item.id === id) ?? [],
  );
  const summary = app.getVisitSummary();
  function act(action: () => unknown) {
    try {
      action();
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "操作できませんでした。",
      );
    }
  }
  function toggleVisit(id: string) {
    act(() =>
      app.setVisitOrder(
        app.state.visitIds.includes(id)
          ? app.state.visitIds.filter((entry) => entry !== id)
          : [...app.state.visitIds, id],
      ),
    );
  }
  return (
    <div className="map-app">
      <header className="map-header">
        <a className="map-brand" href="/" aria-label="最初の画面">
          <span className="map-brand-mark">↗</span> MICHIKUSA{" "}
          <small>MAP</small>
        </a>
        <span className="map-event">SUBAKO HACKATHON / SHIBUYA</span>
      </header>
      <main className="map-main">
        <div className="map-heading">
          <div>
            <p className="map-eyebrow">A LITTLE DETOUR, A GOOD DISCOVERY.</p>
            <h1>{title}</h1>
            <p className="map-subtitle">{subtitle}</p>
          </div>
        </div>
        {app.notice && (
          <div className="map-notice" role="status">
            {app.notice}
            <button onClick={() => app.setNotice("")} aria-label="通知を閉じる">
              ×
            </button>
          </div>
        )}
        {actionError && (
          <div className="map-error" role="alert">
            {actionError}
          </div>
        )}
        <div className="map-layout">
          <div className="map-explore">
            <MapCanvas app={app} />
            <section className="map-places">
              <div className="map-section-heading">
                <h2>
                  寄り道の候補 <span>{app.state.items.length}</span>
                </h2>
                <label className="map-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="名前・エリアで探す"
                    aria-label="地点を検索"
                  />
                </label>
              </div>
              {app.state.items.length === 0 ? (
                <div className="map-empty">
                  <span>↗</span>
                  <h3>地点がありません。</h3>
                  <p>登録された地点がここに表示されます。</p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="map-no-results">一致する地点がありません。</p>
              ) : (
                <div className="map-card-grid">
                  {filtered.map((item) => {
                    const index = app.state.items.findIndex(
                      (entry) => entry.id === item.id,
                    );
                    const inVisit = app.state.visitIds.includes(item.id);
                    return (
                      <article
                        key={item.id}
                        className={`map-place-card${app.state.candidateIds.includes(item.id) ? " is-candidate" : ""}${selected?.id === item.id ? " is-selected" : ""}`}
                      >
                        <button
                          className="map-card-open"
                          onClick={() => app.selectItem(item.id)}
                        >
                          <span className="map-card-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <h3>{item.name}</h3>
                            <p>{item.address}</p>
                          </span>
                          <span aria-hidden="true">↗</span>
                        </button>
                        <p className="map-card-description">
                          {item.description}
                        </p>
                        <div className="map-tags">
                          {item.tags.map((tag, tagIndex) => (
                            <span key={`${tag}-${tagIndex}`}>{tag}</span>
                          ))}
                        </div>
                        <div className="map-card-bottom">
                          <button
                            className="map-text-button"
                            aria-pressed={app.state.candidateIds.includes(item.id)}
                            onClick={() => app.showCandidates(
                              app.state.candidateIds.includes(item.id)
                                ? app.state.candidateIds.filter((id) => id !== item.id)
                                : [...app.state.candidateIds, item.id],
                            )}
                          >
                            {app.state.candidateIds.includes(item.id)
                              ? "候補を解除"
                              : "候補にする"}
                          </button>
                          <button
                            className={inVisit ? "map-add is-added" : "map-add"}
                            onClick={() => toggleVisit(item.id)}
                            aria-pressed={inVisit}
                          >
                            {inVisit ? "✓ 訪問リスト" : "+ 行ってみたい"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          <aside className="map-side">
            <section className="map-itinerary">
              <p className="map-eyebrow">YOUR LITTLE JOURNEY</p>
              <div className="map-section-heading">
                <h2>今日の寄り道</h2>
                <span>{visitItems.length}か所</span>
              </div>
              <p className="map-start">出発：渋谷駅</p>
              {visitItems.length === 0 ? (
                <p className="map-route-empty">
                  「行ってみたい」を押すと、ここに訪問順が並びます。
                </p>
              ) : (
                <ol className="map-visit-list">
                  {visitItems.map((item, index) => (
                    <li key={item.id}>
                      <span className="map-visit-number">{index + 1}</span>
                      <div className="map-visit-content">
                        <button
                          className="map-text-button"
                          onClick={() => app.selectItem(item.id)}
                        >
                          {item.name}
                        </button>
                        <small>
                          前の地点から直線{" "}
                          {summary.segments[index]?.distanceKm.toFixed(2)}{" "}
                          km・移動 約
                          {summary.segments[index]?.estimatedWalkMinutes}分
                        </small>
                        <div className="map-visit-actions">
                          <button
                            aria-pressed={app.state.pinnedIds.includes(item.id)}
                            onClick={() =>
                              act(() =>
                                app.setPinned(
                                  item.id,
                                  !app.state.pinnedIds.includes(item.id),
                                ),
                              )
                            }
                          >
                            {app.state.pinnedIds.includes(item.id)
                              ? "● 固定中"
                              : "○ 固定する"}
                          </button>
                          <button
                            disabled={index === 0}
                            aria-label={`${item.name}を前に移動`}
                            onClick={() =>
                              act(() => {
                                const ids = [...app.state.visitIds];
                                [ids[index - 1], ids[index]] = [
                                  ids[index]!,
                                  ids[index - 1]!,
                                ];
                                app.setVisitOrder(ids);
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            disabled={index === visitItems.length - 1}
                            aria-label={`${item.name}を後に移動`}
                            onClick={() =>
                              act(() => {
                                const ids = [...app.state.visitIds];
                                [ids[index], ids[index + 1]] = [
                                  ids[index + 1]!,
                                  ids[index]!,
                                ];
                                app.setVisitOrder(ids);
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            disabled={app.state.pinnedIds.includes(item.id)}
                            onClick={() => toggleVisit(item.id)}
                            aria-label={`${item.name}を訪問リストから外す`}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {visitItems.length > 0 && (
                <>
                  <div className="map-total">
                    <span>移動時間の目安</span>
                    <strong>
                      約{summary.estimatedWalkMinutes}
                      <small>分</small>
                    </strong>
                  </div>
                  <p className="map-route-note">{summary.note}</p>
                </>
              )}
            </section>
          </aside>
        </div>
        <footer className="map-footer">
          <span>
            好きな場所が、次のアイデアになる。
            <br />
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              地図：© OpenStreetMap contributors / ODbL
            </a>{" "}
            ·{" "}
            <a
              href="https://www.openstreetmap.org/fixthemap"
              target="_blank"
              rel="noreferrer"
            >
              地図の誤りを報告
            </a>
          </span>
        </footer>
      </main>
      {selected && (
        <Dialog
          title={selected.name}
          onClose={() => app.selectItem(null)}
          className="map-dialog"
        >
          <p>{selected.description}</p>
          <div className="map-tags">
            {selected.tags.map((tag, index) => (
              <span key={index}>{tag}</span>
            ))}
          </div>
          <p className="map-detail-address">{selected.address}</p>
          {selected.url && (
            <a
              className="map-official"
              href={selected.url}
              target="_blank"
              rel="noreferrer"
            >
              公式サイトで確認 ↗
            </a>
          )}
          <button
            className="map-button"
            disabled={app.state.pinnedIds.includes(selected.id)}
            onClick={() => toggleVisit(selected.id)}
          >
            {app.state.visitIds.includes(selected.id)
              ? "訪問リストから外す"
              : "訪問リストに追加"}
          </button>
        </Dialog>
      )}
    </div>
  );
}
