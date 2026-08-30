"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: { email, name, password },
      });
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
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
          注册
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ink-light)" }}>
          建一个账号，开始写第一场。
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm" style={{ color: "var(--ink-wash)" }}>
              名称
            </span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border px-3 text-sm bg-white"
              style={{ borderColor: "var(--at-border)", color: "var(--ink-black)" }}
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={8}
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
            {pending ? "注册中…" : "注册"}
          </button>
        </form>
        <p className="mt-6 text-sm" style={{ color: "var(--ink-light)" }}>
          已有账号？{" "}
          <Link href="/login" style={{ color: "var(--persimmon)" }}>
            登录
          </Link>
        </p>
      </main>
    </div>
  );
}
