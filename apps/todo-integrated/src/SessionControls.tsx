import type { ReactNode } from "react";
import type { SessionConnection } from "@subako-ai/sdk";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { SubakoToolApproval } from "@subako-ai/assistant-ui";
import { useSessionState } from "@subako-ai/react";
import "./session.css";

/** 会話の枠。状態は `useSessionId` が持ち、ここは表示と操作だけを担当します。 */
export function SessionControls({ session, creating, error, onNew, children }: {
  session: SessionConnection | null;
  creating: boolean;
  error: string;
  onNew: () => void;
  children: ReactNode;
}) {
  const state = useSessionState(session);
  const running = state?.isRunning && state.status !== "failed";
  const connecting = !state || state.status === "connecting" || state.status === "reconnecting";

  return (
    <div className="session-conversation" aria-busy={creating}>
      <div className="session-toolbar">
        <button
          type="button"
          disabled={creating || running || connecting}
          onClick={onNew}
          title="会話を新しくします。アプリ内のデータは引き継がれます。"
        >
          <span aria-hidden="true">＋</span>
          {creating ? "作成中…" : "新しいセッション"}
        </button>
        {running && <span>応答後、または停止後に切り替えられます。</span>}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>
      <div className="session-chat" inert={creating}>{children}</div>
    </div>
  );
}

/** 最初の会話ができるまでの表示。失敗しても、ここから作り直せます。 */
export function SessionPending({ creating, error, onRetry }: {
  creating: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="session-conversation" aria-busy={creating}>
      <div className="session-toolbar">
        {creating ? (
          <span>会話を準備しています…</span>
        ) : (
          <button type="button" onClick={onRetry}>もう一度試す</button>
        )}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

// 補足データは省略し、操作の状態と承認ボタンを表示します。
export function SafeToolResult(props: ToolCallMessagePartProps) {
  const { result, isError, approval } = props;
  const waiting = approval && approval.approved === undefined && approval.resolution === undefined;
  let message = result === undefined ? "アプリを操作しています…" : "アプリの操作結果を受け取りました";
  if (isError) message = "アプリの操作に失敗しました";
  if (waiting) message = "操作の承認を待っています";
  if (approval?.approved === false) message = "操作を許可しませんでした";
  if (approval?.resolution) message = "操作の承認待ちは終了しました";

  return (
    <div className="tool-status">
      <span className={isError ? "session-error" : undefined}>{message}</span>
      <SubakoToolApproval {...props} />
    </div>
  );
}
