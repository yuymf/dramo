"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

interface AuthMe {
  user?: { id: string; email: string; name?: string | null };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<AuthMe>("/api/auth/me", { noCache: true })
      .then((res) => {
        if (cancelled) return;
        if (res?.user?.id) {
          setOk(true);
          return;
        }
        router.replace(`/login?next=${encodeURIComponent(pathname || "/home")}`);
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/home")}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ok) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm"
        style={{ color: "var(--ink-light)" }}
      >
        正在进入书桌…
      </div>
    );
  }

  return <>{children}</>;
}
