import { AppShell } from "@/components/AppShell";
import { MetricsProvider } from "@/components/MetricsProvider";
import { ToastProvider } from "@/components/Toast";
import { SessionProvider } from "@/components/SessionProvider";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <SessionProvider>
        <MetricsProvider>
          <AppShell>{children}</AppShell>
        </MetricsProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
