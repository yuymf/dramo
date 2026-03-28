import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User } from "next-auth";
import type { PlanId } from "@/lib/billing/types";

const backendUrl =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:12321";

interface BackendLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码");
        }

        let response: Response;
        try {
          response = await fetch(`${backendUrl}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
        } catch (error) {
          console.error("[auth] Network error during login:", error);
          throw new Error("网络连接失败，请检查网络后重试");
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message =
            errorBody?.error?.message ??
            errorBody?.message ??
            "登录失败，请检查账号或稍后重试";
          throw new Error(message);
        }

        const data = (await response.json()) as BackendLoginResponse;

        if (!data?.token || !data?.user?.id) {
          throw new Error("登录响应无效");
        }

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? data.user.email,
          backendToken: data.token,
        } as User & { backendToken: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.backendToken = (user as User & { backendToken: string }).backendToken;
        token.sub = user.id;
        token.planId = (user as User & { planId?: string }).planId ?? 'free';
      }
      // When client calls update() to refresh subscription
      if (trigger === 'update' && token.backendToken) {
        try {
          const res = await fetch(`${backendUrl}/api/billing/subscription`, {
            headers: { Authorization: `Bearer ${token.backendToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            token.planId = data.planId ?? 'free';
          }
        } catch (error) {
          console.error('[auth] Failed to refresh planId:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub as string;
      }
      if (token.backendToken) {
        session.backendToken = token.backendToken as string;
      } else {
        delete session.backendToken;
      }
      session.planId = (token.planId as PlanId) ?? 'free';
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

