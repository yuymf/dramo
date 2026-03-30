"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 验证重定向URL是否安全（仅允许相对路径）
  const getSafeRedirect = (url: string | null): string => {
    if (!url) return "/projects";
    // Only allow relative paths starting with /
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    return "/projects";
  };

  // 如果已登录，直接跳转
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getSafeRedirect(searchParams.get("redirect")));
    }
  }, [router, searchParams, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 验证密码匹配
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      setIsLoading(false);
      return;
    }

    // 验证密码长度
    if (password.length < 6) {
      setError("密码长度至少为6个字符");
      setIsLoading(false);
      return;
    }

    try {
      // 调用注册API（通过 Next.js API Routes 代理）
      const response = await fetch("/api/auth/register", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name: name || undefined }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: '注册失败，请重试' } }));
        throw new Error(errorData.error?.message || '注册失败，请重试');
      }

      // 注册成功后自动登录
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      const redirect = getSafeRedirect(searchParams.get("redirect"));
      router.replace(redirect);
    } catch (error) {
      console.error('Register failed:', error);
      setError(error instanceof Error ? error.message : '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            <Image
              src="/logo.jpg"
              alt="Logo"
              fill
              sizes="96px"
              priority
              className="object-contain"
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          注册账户
        </h1>
        <p className="text-center text-slate-600 mb-8 text-sm">
          创建您的 Dramo.ai 账户
        </p>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              姓名（可选）
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="您的姓名"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent outline-none transition"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="至少6个字符"
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              确认密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="再次输入密码"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium"
            size="lg"
          >
            {isLoading ? "注册中..." : "注册"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          已有账户？{" "}
          <Link 
            href="/login" 
            className="text-[var(--brand-500)] hover:text-[var(--brand-600)] font-medium"
          >
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}

