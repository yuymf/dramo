import { AppSidebar } from "@/components/layout/AppSidebar";
import { LLMConfigManager } from "@/components/settings/LLMConfigManager";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen rice-paper-bg">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto ink-scroll">
        <div className="max-w-3xl mx-auto px-8 pt-16 pb-6">
          <h1
            className="text-3xl font-bold mb-8"
            style={{
              fontFamily: "var(--font-noto-sans-sc), sans-serif",
              color: "var(--ink-black)",
              letterSpacing: "-0.03em",
            }}
          >
            设置
          </h1>
          <h2
            className="text-[17px] font-semibold mb-6"
            style={{ color: "var(--ink-black)" }}
          >
            AI 模型配置
          </h2>
          <LLMConfigManager />
        </div>
      </main>
    </div>
  );
}
