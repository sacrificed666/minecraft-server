"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "player";
export type Me = { username: string; role: Role };

const SessionContext = createContext<Me | null>(null);

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}
