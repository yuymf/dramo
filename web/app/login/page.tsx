"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/home";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center rice-paper-bg px-6">
      <main className="w-full max-w-sm relative z-10">
        <Link
          href="/"
          className="block text-center text-sm font-bold tracking-[0.16em] mb-10"
          style={{ color: "var(--ink-black)" }}
        >
          DRAMO
        </Link>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--ink-black)", letterSpacing: "-0.03em" }}
        >
          登录
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ink-light)" }}>
          用邮箱进入书桌。
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm" style={{ color: "var(--ink-wash)" }}>
              邮箱
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-lg border px-3 text-sm bg-white"
              style={{ borderColor: "var(--at-border)", color: "var(--ink-black)" }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm" style={{ color: "var(--ink-wash)" }}>
              密码
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-lg border px-3 text-sm bg-white"
              style={{ borderColor: "var(--at-border)", color: "var(--ink-black)" }}
            />
          </label>
          {error ? (
            <p className="text-sm" style={{ color: "var(--at-error)" }} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--persimmon)", color: "#fff7ed" }}
          >
            {pending ? "登录中…" : "登录"}
          </button>
        </form>
        <p className="mt-6 text-sm" style={{ color: "var(--ink-light)" }}>
          还没有账号？{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} style={{ color: "var(--persimmon)" }}>
            注册
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
