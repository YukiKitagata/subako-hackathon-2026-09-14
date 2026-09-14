import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { SubakoSessionClient } from "@subako-ai/sdk";
import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
import { SubakoChat } from "@subako-ai/assistant-ui";
import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
import { fetchSessionToken, useSessionId } from "./session";
import { createTodo, parseTodos, setTodoDone, type Todo } from "./model";
import data from "./data.json";
import "./style.css";
import "./layout.css";

const initialItems: Todo[] = parseTodos(data);
const storageKey = "hackathon:todo-integrated";
const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
const sessionStorageKey = `hackathon:session:todo-integrated:${baseUrl}`;
// APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });

function Assistant({ getItems, add, complete, sessionId, creating, error, onNew }: {
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

  useTool(client, "list_todos", {
    description: "現在のTODO一覧を取得します。",
    schema: z.object({}).strict(),
    execute: () => JSON.stringify(getItems()),
  });
  useTool(client, "add_todo", {
    description: "TODOを1件追加します。",
    schema: z.object({ title: z.string().max(300).trim().min(1) }).strict(),
    // フォームと同じ追加関数を呼びます。
    execute: ({ title }) => JSON.stringify(add(title)),
  });
  useTool(client, "set_todo_done", {
    description: "指定したTODOを完了・未完了にします。",
    schema: z.object({ id: z.string(), done: z.boolean() }).strict(),
    execute: ({ id, done }) => JSON.stringify(complete(id, done)),
  });

  return (
    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
    </SessionControls>
  );
}

export default function App() {
  const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
  const [connectionError, setConnectionError] = useState("");
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
        <header>
          <span>SUBAKO / SESSION</span>
          <h2>TODOアシスタント</h2>
          <p>会話しながら、アプリを操作できます。</p>
        </header>
        <div className="session-content">
          {connectionError && <p className="session-error" role="alert">{connectionError}</p>}
          {sessionId ? (
            <SubakoProvider client={subako} onError={() => setConnectionError("接続できません。agentのOrigin設定と開発サーバーを確認してください。") }>
              <Assistant
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
            <SessionPending creating={creating} error={sessionError} onRetry={startNew} />
          )}
        </div>
      </aside>
    </div>
  );
}
