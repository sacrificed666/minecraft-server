"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePolled } from "@/lib/polling";
import type { Session } from "@/lib/session";

/** Who the browser is signed in as. Drives which nav items the UI offers. */
const SessionContext = createContext<Session | null>(null);

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data } = usePolled<Session>("/api/me");
  return <SessionContext.Provider value={data}>{children}</SessionContext.Provider>;
}
