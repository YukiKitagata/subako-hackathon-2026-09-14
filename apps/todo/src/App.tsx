import { useEffect, useRef, useState, type FormEvent } from "react";
import { createTodo, parseTodos, setTodoDone, type Todo } from "./model";
import data from "./data.json";
import "./style.css";
import "./layout.css";
import "./session.css";

// ──────────────────────────────────────────────────────────────
// TODO(1) SDKと、同じフォルダの session.ts をimportする
//    session.ts は最初から置いてあります。先に npm install を済ませてください。
//    session.css はサイドバーの枠に使うので、すでに上でimportしています。
// ──────────────────────────────────────────────────────────────
import { z } from "zod";
import { SubakoSessionClient } from "@subako-ai/sdk";
import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
import { SubakoChat } from "@subako-ai/assistant-ui";
import { fetchSessionToken, useSessionId } from "./session";

const initialItems: Todo[] = parseTodos(data);
const storageKey = "hackathon:todo";

// ──────────────────────────────────────────────────────────────
// TODO(2) 会話につなぐクライアントを用意する
//    APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
// ──────────────────────────────────────────────────────────────
const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
const sessionStorageKey = `hackathon:session:todo:${baseUrl}`;
const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });

// ──────────────────────────────────────────────────────────────
// TODO(3) 会話を担当するコンポーネントを追加する
//    execute の中身は、フォームが使っている add() をそのまま呼ぶだけです。
// ──────────────────────────────────────────────────────────────
function TodoAssistant({ getItems, add, complete, sessionId, creating, error, onNew }: {
  getItems: () => Todo[];
  add: (title: string) => Todo;
  complete: (id: string, done: boolean) => Todo;
  sessionId: string;
  creating: boolean;
  error: string;
  onNew: () => void;
}) {
  const session = useSession(sessionId);
  const client = useToolClient(session, "todo");
  const state = useSessionState(session);
  const running = state?.isRunning && state.status !== "failed";
  const connecting = !state || state.status === "connecting" || state.status === "reconnecting";

  useTool(client, "list_todos", {
    description: "現在のTODOを取得する。",
    schema: z.object({}).strict(),
    execute: () => JSON.stringify(getItems()),
  });

  useTool(client, "add_todo", {
    description: "TODOを1件追加する。",
    schema: z.object({ title: z.string().max(300).trim().min(1) }).strict(),
    execute: ({ title }) => JSON.stringify(add(title)),
  });

  // TODO(4) ここに完了ツールを足す。ここだけ雛形がありません。
  //   ツール名  set_todo_done
  //   説明      一覧で取得したidのTODOを完了・未完了にする。
  //   引数      id: string / done: boolean
  //   execute   complete(id, done) を呼び、JSON.stringify で返す
  useTool(client, 'set_todo_done', {
     description: '一覧で取得したidのTODOを完了・未完了にする。',
    schema: z.object({
      id: z.string(),
      done: z.boolean(),
    }).strict(),
    execute: ({ id, done }) =>
      JSON.stringify(complete(id, done)),
  })

  return (
    <div className="session-conversation" aria-busy={creating}>
      <div className="session-toolbar">
        <button
          type="button"
          disabled={creating || running || connecting}
          onClick={onNew}
          title="会話を新しくします。TODOのデータは引き継がれます。"
        >
          {creating ? "作成中…" : "＋ 新しいセッション"}
        </button>
        {running && <span>応答後、または停止後に切り替えられます。</span>}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>
      <div className="session-chat" inert={creating}>
        <SubakoChat session={session} />
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return { items: saved === null ? initialItems : parseTodos(JSON.parse(saved)), error: "" };
    } catch {
      return { items: initialItems, error: "保存データを読めなかったため、初期データを表示しました。" };
    }
  });
  const [items, setItems] = useState(initial.items);
  const currentItems = useRef(items);
  const [error, setError] = useState(initial.error);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  // ──────────────────────────────────────────────────────────────
  // TODO(5) 使う会話を用意する
  //    保存済みの会話があれば続きから、無ければ新しく作ります。
  //    startNew は会話だけを作り直し、TODOは残します。
  // ──────────────────────────────────────────────────────────────
  const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
  const active = items.filter((item) => !item.done).length;
  const visible = items.filter(
    (item) => filter === "all" || (filter === "done" ? item.done : !item.done),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      setError("ブラウザーに保存できません。再読み込みすると変更が失われる可能性があります。");
    }
  }, [items]);

  function getItems() {
    return currentItems.current;
  }
  function updateItems(next: Todo[]) {
    // 再描画前の連続操作にも、直前の変更を渡します。
    currentItems.current = next;
    setItems(next);
    setError("");
  }
  function add(title: string) {
    const current = getItems();
    if (current.length >= 500) throw new Error("TODOは500件まで追加できます。");
    const todo = createTodo(title);
    updateItems([...current, todo]);
    return todo;
  }
  function complete(id: string, done: boolean) {
    const next = setTodoDone(getItems(), id, done);
    updateItems(next);
    return next.find((item) => item.id === id)!;
  }
  function remove(id: string) {
    updateItems(getItems().filter((item) => item.id !== id));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      add(title);
      setTitle("");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <div className="app-layout has-session">
      <div className="app-panel">
        <div className="app-content">
          <div className="todo-shell">
            <header className="todo-header">
              <a className="todo-brand" href="/">
                subako<span> / hackathon</span>
              </a>
              <span className="todo-badge">
                TODAY’S PLAN
              </span>
            </header>
            <div className="todo-layout">
              <main className="todo-main">
                <p className="todo-eyebrow">SMALL STEPS, GOOD IDEAS.</p>
                <h1>
                  ひとつずつ、
                  <br />
                  かたちにしよう。
                </h1>
                <p className="todo-lead">
                  思いついたことを、今日の一歩に。
                  <br />
                  小さな予定も、ここから始めましょう。
                </p>
                <section className="todo-board" aria-label="TODO一覧">
                  <div className="todo-board-title">
                    <h2>やること</h2>
                    <span>
                      あと <b>{active}</b> 件
                    </span>
                  </div>
                  <form onSubmit={submit} className="todo-add">
                    <label className="sr-only" htmlFor="new-todo">
                      新しいTODO
                    </label>
                    <input
                      id="new-todo"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="次にやることを入力"
                      maxLength={300}
                      required
                    />
                    <button type="submit">
                      追加する <span aria-hidden="true">＋</span>
                    </button>
                  </form>
                  <div className="todo-filters" aria-label="絞り込み">
                    {(
                      [
                        ["all", "すべて"],
                        ["active", "未完了"],
                        ["done", "完了"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={filter === value ? "selected" : ""}
                        onClick={() => setFilter(value)}
                        aria-pressed={filter === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {error && (
                    <p role="alert" className="todo-error">
                      {error}
                    </p>
                  )}
                  {visible.length ? (
                    <ul className="todo-list">
                      {visible.map((item) => (
                        <li key={item.id} className={item.done ? "done" : ""}>
                          <label>
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={(e) =>
                                complete(item.id, e.target.checked)
                              }
                            />
                            <span>{item.title}</span>
                          </label>
                          <button
                            onClick={() => remove(item.id)}
                            aria-label={`${item.title}を削除`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="todo-empty">
                      <div aria-hidden="true">✓</div>
                      <h3>
                        {items.length
                          ? "この一覧は空です"
                          : "最初のひとつを、ここに。"}
                      </h3>
                      <p>
                        {items.length
                          ? "別の絞り込みを選んでみてください。"
                          : "上の入力欄から、今日の予定を追加してみましょう。"}
                      </p>
                    </div>
                  )}
                </section>
                <p className="todo-caption">SUBAKO HACKATHON · SHIBUYA · 2026.09.14</p>
              </main>
            </div>
          </div>
        </div>
      </div>

      <aside className="session-sidebar" aria-label="TODOアシスタント">
        <header className="session-header">
          <h2>TODOアシスタント</h2>
          <p>会話しながら、アプリを操作できます。</p>
        </header>
        <div className="session-content">
          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
            {sessionId ? (
              <SubakoProvider client={subako}>
                <TodoAssistant
                  key={sessionId}
                  getItems={getItems}
                  add={add}
                  complete={complete}
                  sessionId={sessionId}
                  creating={creating}
                  error={sessionError}
                  onNew={startNew}
                />
              </SubakoProvider>
            ) : (
              <div className="session-toolbar" aria-busy={creating}>
                {creating ? (
                  <span>会話を準備しています…</span>
                ) : (
                  <button type="button" onClick={startNew}>もう一度試す</button>
                )}
                {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
              </div>
            )}
        </div>
      </aside>
    </div>
  );
}
