"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Kind = "ok" | "error" | "info";
type Toast = { id: number; kind: Kind; text: string };

const ToastContext = createContext<(kind: Kind, text: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const COLOR: Record<Kind, string> = {
  ok: "var(--good)",
  error: "var(--critical)",
  info: "var(--series-tps)",
};

const ICON: Record<Kind, string> = { ok: "✓", error: "✕", info: "i" };

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* aria-live so screen readers hear results that are otherwise only visual */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass rise pointer-events-auto flex max-w-md items-start gap-2.5 px-4 py-2.5 text-sm shadow-xl"
          >
            <span
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ background: COLOR[t.kind] }}
              aria-hidden="true"
            >
              {ICON[t.kind]}
            </span>
            <span className="min-w-0 break-words">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
