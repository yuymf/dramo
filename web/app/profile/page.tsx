import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Mail, User, Calendar, BookOpen, Pen, LogOut } from "lucide-react";

export const metadata = {
  title: "个人资料 - DRAMO",
  description: "用户个人资料页面",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?redirect=/profile");
  }

  const userName = session.user?.name || "创作者";
  const userEmail = session.user?.email || "未设置";
  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />

      <main className="flex-1 relative z-10 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 lg:px-16 py-16">
          {/* Page header */}
          <div className="ink-reveal">
            <p
              className="text-xs tracking-widest uppercase mb-3 ink-ui"
              style={{ color: "var(--ink-light)", letterSpacing: "0.2em" }}
            >
              Profile
            </p>
            <h1
              className="text-3xl lg:text-4xl ink-display mb-12"
              style={{ color: "var(--ink-black)" }}
            >
              个人资料
            </h1>
          </div>

          {/* Profile card */}
          <div className="ink-card p-8 mb-8 ink-reveal ink-reveal-1">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="ink-avatar flex-shrink-0">
                {initial}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2
                  className="text-xl font-medium ink-display mb-1"
                  style={{ color: "var(--ink-black)" }}
                >
                  {userName}
                </h2>
                <p
                  className="text-sm ink-ui"
                  style={{ color: "var(--ink-light)" }}
                >
                  DRAMO 创作者
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="ink-divider" style={{ margin: "24px 0" }} />

            {/* Info rows */}
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--rice-warm)" }}
                >
                  <User
                    className="w-4 h-4"
                    style={{ color: "var(--ink-wash)" }}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs mb-0.5 ink-ui"
                    style={{ color: "var(--ink-light)" }}
                  >
                    用户名
                  </p>
                  <p
                    className="text-sm ink-body truncate"
                    style={{ color: "var(--ink-black)" }}
                  >
                    {userName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--rice-warm)" }}
                >
                  <Mail
                    className="w-4 h-4"
                    style={{ color: "var(--ink-wash)" }}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs mb-0.5 ink-ui"
                    style={{ color: "var(--ink-light)" }}
                  >
                    邮箱
                  </p>
                  <p
                    className="text-sm ink-body truncate"
                    style={{ color: "var(--ink-black)" }}
                  >
                    {userEmail}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-8 ink-reveal ink-reveal-2">
            <div className="ink-card">
              <div className="ink-stat">
                <div className="ink-stat-value">--</div>
                <div className="ink-stat-label ink-ui">项目总数</div>
              </div>
            </div>
            <div className="ink-card">
              <div className="ink-stat">
                <div className="ink-stat-value">--</div>
                <div className="ink-stat-label ink-ui">剧本字数</div>
              </div>
            </div>
            <div className="ink-card">
              <div className="ink-stat">
                <div className="ink-stat-value">--</div>
                <div className="ink-stat-label ink-ui">创作天数</div>
              </div>
            </div>
          </div>

          {/* Preferences section */}
          <div className="ink-card p-8 mb-8 ink-reveal ink-reveal-3">
            <h3
              className="text-sm tracking-wider uppercase mb-6 ink-ui"
              style={{ color: "var(--ink-light)", letterSpacing: "0.15em" }}
            >
              创作偏好
            </h3>

            <div className="space-y-4">
              <div
                className="flex items-center justify-between py-3 border-b"
                style={{ borderColor: "rgba(26, 26, 24, 0.04)" }}
              >
                <div className="flex items-center gap-3">
                  <Pen
                    className="w-4 h-4"
                    style={{ color: "var(--ink-light)" }}
                    strokeWidth={1.5}
                  />
                  <span
                    className="text-sm ink-body"
                    style={{ color: "var(--ink-wash)" }}
                  >
                    默认创作类型
                  </span>
                </div>
                <span
                  className="text-sm ink-ui"
                  style={{ color: "var(--ink-light)" }}
                >
                  短片剧本
                </span>
              </div>

              <div
                className="flex items-center justify-between py-3 border-b"
                style={{ borderColor: "rgba(26, 26, 24, 0.04)" }}
              >
                <div className="flex items-center gap-3">
                  <BookOpen
                    className="w-4 h-4"
                    style={{ color: "var(--ink-light)" }}
                    strokeWidth={1.5}
                  />
                  <span
                    className="text-sm ink-body"
                    style={{ color: "var(--ink-wash)" }}
                  >
                    AI 写作风格
                  </span>
                </div>
                <span
                  className="text-sm ink-ui"
                  style={{ color: "var(--ink-light)" }}
                >
                  自然叙事
                </span>
              </div>

              <div
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <Calendar
                    className="w-4 h-4"
                    style={{ color: "var(--ink-light)" }}
                    strokeWidth={1.5}
                  />
                  <span
                    className="text-sm ink-body"
                    style={{ color: "var(--ink-wash)" }}
                  >
                    加入时间
                  </span>
                </div>
                <span
                  className="text-sm ink-ui"
                  style={{ color: "var(--ink-light)" }}
                >
                  2025
                </span>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="ink-reveal ink-reveal-4">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/signout"
              className="inline-flex items-center gap-2 text-sm ink-ui transition-colors hover:text-[var(--persimmon)]"
              style={{ color: "var(--ink-light)" }}
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              退出登录
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
