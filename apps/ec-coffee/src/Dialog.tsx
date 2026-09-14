import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Dialog({ title, onClose, children, className = "" }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const host = document.getElementById("app-dialogs");

  useLayoutEffect(() => {
    if (!host) return;
    const content = host.parentElement?.querySelector<HTMLElement>(".app-content");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    if (content) content.inert = true;
    closeButton.current?.focus();
    return () => {
      const restore = element?.contains(document.activeElement) || document.activeElement === document.body;
      if (content) content.inert = host.querySelectorAll('[role="dialog"]').length > 1;
      // 別の入力欄へ移ったフォーカスは戻しません。
      if (restore) requestAnimationFrame(() => {
        if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
      });
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div className="dialog-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialog}
        role="dialog"
        aria-labelledby={titleId}
        className={`app-dialog ${className}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="閉じる">×</button>
        </header>
        {children}
      </section>
    </div>,
    host,
  );
}
