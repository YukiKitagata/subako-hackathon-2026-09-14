import { Dialog } from "./Dialog";
import { useRef, useState } from "react";
import { cartSummary } from "./model";
import type { CatalogItem } from "./model";
import type { CatalogStore } from "./useCatalog";

const yen = (amount: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(
    amount,
  );
const colors = [
  "#c17c57",
  "#597864",
  "#bf9d5e",
  "#657d8e",
  "#915f64",
  "#8b8658",
];

function ProductArt({
  item,
  index,
}: {
  item: CatalogItem;
  index: number;
}) {
  return (
    <div
      className="ec-product-art"
      aria-hidden="true"
    >
      <span className="ec-art-number">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        className="ec-product-placeholder"
        style={{ borderBottomColor: colors[index % colors.length] }}
      >
        <span className="ec-placeholder-brand">SELECT</span>
        <span className="ec-placeholder-mark">◇</span>
        <span className="ec-placeholder-unit">{item.unit}</span>
      </div>
      <span className="ec-art-caption">
        YOUR COLLECTION
      </span>
    </div>
  );
}

export function CatalogView({ store }: { store: CatalogStore }) {
  const { state } = store;
  const [error, setError] = useState("");
  const cartRef = useRef<HTMLElement>(null);
  const summary = cartSummary(state.cart, state.data.items);
  const shown =
    state.shownIds === null
      ? state.data.items
      : state.shownIds
          .map((id) => state.data.items.find((item) => item.id === id)!)
          .filter(Boolean);
  const details = state.data.items.find((item) => item.id === state.detailId);
  const compared = state.comparedIds
    .map((id) => state.data.items.find((item) => item.id === id)!)
    .filter(Boolean);

  function perform(action: () => unknown) {
    try {
      action();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作に失敗しました。");
    }
  }

  return (
    <div className="ec-app">
      <header className="ec-header">
        <a className="ec-brand" href="/" aria-label="ショップのホーム">
          <span className="ec-brand-symbol">s.</span>
          <span>
            SELECT MARKET
            <small>SUBAKO HACKATHON</small>
          </span>
        </a>
        <nav aria-label="ショップ">
          <span className="ec-nav-current">カタログ</span>
          <button
            type="button"
            className="ec-text-button"
            onClick={() =>
              cartRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            カート <span className="ec-count">{summary.quantity}</span>
          </button>
        </nav>
        <span className="ec-demo-badge">DEMO STORE</span>
      </header>

      <main className="ec-main">
        <section className="ec-intro">
          <div>
            <p className="ec-eyebrow">
              MAKE IT YOUR OWN.
            </p>
            <h1>{state.data.title}</h1>
            <p className="ec-description">{state.data.description}</p>
          </div>
          <div className="ec-intro-note">
            <span>あなたがつくる</span>
            <strong>新しい買い物体験</strong>
            <span>
              気になる商品を、自由に組み合わせよう。
            </span>
          </div>
        </section>

        {error && (
          <p role="alert" className="ec-error">
            {error}
          </p>
        )}
        {store.storageError && (
          <p role="alert" className="ec-error">
            {store.storageError}
          </p>
        )}
        <p role="status" className="ec-notice">
          {state.notice ||
            "変更はこのブラウザーに保存されます。"}
        </p>

        <div className="ec-layout">
          <div className="ec-catalog">
            <div className="ec-catalog-heading">
              <div>
                <span className="ec-eyebrow">COLLECTION</span>
                <h2>
                  気になるものを、少しずつ。<span>{shown.length} ITEMS</span>
                </h2>
              </div>
              <label className="ec-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="商品を探す"
                  aria-label="商品を探す"
                  value={state.query}
                  onChange={(event) => store.search(event.target.value)}
                />
              </label>
            </div>
            {state.shownIds !== null && (
              <div className="ec-filter-notice">
                <span>条件に合う商品を表示中</span>
                <button
                  type="button"
                  className="ec-text-button"
                  onClick={() => store.showItems(null)}
                >
                  すべての商品に戻す
                </button>
              </div>
            )}

            {shown.length === 0 ? (
              <div className="ec-empty">
                <span className="ec-empty-mark">◇</span>
                <h3>
                  {state.data.items.length === 0
                    ? "最初のコレクションを作ろう。"
                    : "条件に合う商品がありません。"}
                </h3>
                <p>
                  {state.data.items.length === 0
                    ? "現在、商品は登録されていません。"
                    : "検索条件や候補の絞り込みを変えてみてください。"}
                </p>
              </div>
            ) : (
              <div className="ec-grid">
                {shown.map((item) => {
                  const index = state.data.items.findIndex(
                    (entry) => entry.id === item.id,
                  );
                  const quantity =
                    state.cart.find((line) => line.itemId === item.id)
                      ?.quantity ?? 0;
                  return (
                    <article className="ec-product" key={item.id}>
                      <button
                        type="button"
                        className="ec-art-button"
                        aria-label={`${item.name}の詳細を見る`}
                        onClick={() => store.showDetail(item.id)}
                      >
                        <ProductArt item={item} index={index} />
                      </button>
                      <div className="ec-product-content">
                        <div className="ec-tags">
                          {item.tags.map((tag, tagIndex) => (
                            <span key={`${tag}-${tagIndex}`}>{tag}</span>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="ec-product-name"
                          onClick={() => store.showDetail(item.id)}
                        >
                          {item.name}
                        </button>
                        <p>{item.description}</p>
                        <div className="ec-product-price">
                          <strong>{yen(item.price)}</strong>
                          <span> / {item.unit}</span>
                          <small>
                            {item.stock === 0
                              ? "在庫なし"
                              : `在庫 ${item.stock}`}
                          </small>
                        </div>
                        <div className="ec-product-actions">
                          <label className="ec-compare-check">
                            <input
                              type="checkbox"
                              checked={state.comparedIds.includes(item.id)}
                              onChange={(event) =>
                                perform(() =>
                                  store.compareItems(
                                    event.target.checked
                                      ? [...state.comparedIds, item.id]
                                      : state.comparedIds.filter(
                                          (id) => id !== item.id,
                                        ),
                                  ),
                                )
                              }
                            />
                            比較
                          </label>
                          <button
                            type="button"
                            className="ec-add-button"
                            disabled={quantity >= item.stock}
                            onClick={() =>
                              perform(() =>
                                store.setQuantity(item.id, quantity + 1),
                              )
                            }
                          >
                            ＋ カートに追加
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {compared.length > 0 && (
              <section className="ec-comparison" aria-label="商品の比較">
                <div className="ec-section-heading">
                  <h2>
                    比べて選ぶ <span>{compared.length} / 3</span>
                  </h2>
                  <button
                    type="button"
                    className="ec-text-button"
                    onClick={() => store.compareItems([])}
                  >
                    クリア
                  </button>
                </div>
                <div className="ec-comparison-grid">
                  {compared.map((item) => (
                    <article key={item.id}>
                      <h3>{item.name}</h3>
                      <strong>
                        {yen(item.price)} / {item.unit}
                      </strong>
                      <p>{item.description}</p>
                      <button
                        type="button"
                        className="ec-text-button"
                        onClick={() => store.showDetail(item.id)}
                      >
                        詳細を見る →
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section className="ec-cart" ref={cartRef} aria-label="カート">
            <div className="ec-section-heading">
              <div>
                <span className="ec-eyebrow">YOUR SELECTION</span>
                <h2>
                  あなたのセット <span>{summary.quantity}</span>
                </h2>
              </div>
              <span className="ec-cart-symbol" aria-hidden="true">
                ↗
              </span>
            </div>
            {summary.lines.length === 0 ? (
              <p className="ec-cart-empty">
                まだ空っぽです。
                <br />
                気になる商品を組み合わせましょう。
              </p>
            ) : (
              <ul className="ec-cart-lines">
                {summary.lines.map((line) => (
                  <li key={line.itemId}>
                    <div className="ec-cart-line-title">
                      <strong>{line.name}</strong>
                      <span>{yen(line.subtotal)}</span>
                    </div>
                    <div className="ec-cart-line-controls">
                      <small>{line.unit}</small>
                      <div className="ec-stepper">
                        <button
                          type="button"
                          aria-label={`${line.name}を1点減らす`}
                          onClick={() =>
                            perform(() =>
                              store.setQuantity(
                                line.itemId,
                                line.quantity - 1,
                              ),
                            )
                          }
                        >
                          −
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`${line.name}を1点増やす`}
                          disabled={
                            line.quantity >=
                            (state.data.items.find(
                              (item) => item.id === line.itemId,
                            )?.stock ?? 0)
                          }
                          onClick={() =>
                            perform(() =>
                              store.setQuantity(
                                line.itemId,
                                line.quantity + 1,
                              ),
                            )
                          }
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="ec-total">
              <span>合計</span>
              <strong>{yen(summary.total)}</strong>
            </div>
            <button
              type="button"
              className="ec-button ec-checkout-button"
              disabled={summary.lines.length === 0}
              onClick={() => perform(store.openCheckout)}
            >
              購入内容を確認する <span aria-hidden="true">→</span>
            </button>
            {summary.lines.length > 0 && (
              <button
                type="button"
                className="ec-text-button"
                onClick={() => perform(() => store.replaceCart([]))}
              >
                カートを空にする
              </button>
            )}
            <p className="ec-cart-footnote">
              デモ購入です。決済・配送は行いません。
            </p>
          </section>
        </div>

        <footer className="ec-footer">
          <span>SUBAKO HACKATHON · 2026.09.14</span>
          <span>
            YOUR IDEA, YOUR COLLECTION
          </span>
        </footer>
      </main>

      {details && (
        <Dialog
          className="ec-modal"
          title={details.name}
          onClose={() => store.showDetail(null)}
        >
          <p className="ec-modal-description">{details.description}</p>
          <div className="ec-tags">
            {details.tags.map((tag, index) => (
              <span key={`${tag}-${index}`}>{tag}</span>
            ))}
          </div>
          <p className="ec-modal-price">
            {yen(details.price)}{" "}
            <small>
              / {details.unit} · 在庫 {details.stock}
            </small>
          </p>
          <button
            type="button"
            className="ec-button"
            disabled={
              (state.cart.find((line) => line.itemId === details.id)
                ?.quantity ?? 0) >= details.stock
            }
            onClick={() =>
              perform(() =>
                store.setQuantity(
                  details.id,
                  (state.cart.find((line) => line.itemId === details.id)
                    ?.quantity ?? 0) + 1,
                ),
              )
            }
          >
            カートに追加
          </button>
        </Dialog>
      )}
      {state.checkoutOpen && (
        <Dialog
          className="ec-modal"
          title="セットの内容を確認"
          onClose={store.closeCheckout}
        >
          <p>内容を確認して、あなたが最後のボタンを押してください。</p>
          <ul className="ec-checkout-lines">
            {summary.lines.map((line) => (
              <li key={line.itemId}>
                <span>
                  {line.name} × {line.quantity}
                </span>
                <strong>{yen(line.subtotal)}</strong>
              </li>
            ))}
          </ul>
          <div className="ec-total">
            <span>合計</span>
            <strong>{yen(summary.total)}</strong>
          </div>
          <p className="ec-modal-description">
            実際の課金・配送はありません。確定するとデモの在庫が減ります。
          </p>
          <button
            type="button"
            className="ec-button ec-checkout-button"
            onClick={() => perform(store.confirmPurchase)}
          >
            デモの購入を確定する
          </button>
        </Dialog>
      )}
      {state.receipt && (
        <Dialog
          className="ec-modal"
          title="セットができました。"
          onClose={store.dismissReceipt}
        >
          <div className="ec-receipt-mark">✓</div>
          <p className="ec-receipt-total">
            {state.receipt.quantity}点 · {yen(state.receipt.total)}
          </p>
          <p className="ec-modal-description">
            デモの注文を受け付けました。
            <br />
            実際の課金・配送はありません。
          </p>
          <button
            type="button"
            className="ec-button"
            onClick={store.dismissReceipt}
          >
            お買い物を続ける
          </button>
        </Dialog>
      )}
    </div>
  );
}
