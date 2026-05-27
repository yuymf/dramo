import { AppSidebar } from '@/components/layout/AppSidebar';
import { LLMConfigManager } from '@/components/settings/LLMConfigManager';
import { Settings, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen rice-paper-bg">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto ink-scroll">
        {/* Page header */}
        <div className="sticky top-0 z-10 glass-morphism">
          <div className="max-w-3xl mx-auto px-8 py-4 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(26, 26, 24, 0.06)' }}
            >
              <Settings className="w-4 h-4" style={{ color: 'var(--ink-wash)' }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold"
                style={{
                  fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
                  color: 'var(--ink-black)',
                  letterSpacing: '-0.01em',
                }}
              >
                设置
              </h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* AI Configuration Section */}
          <section className="ink-reveal">
            <div className="flex items-center gap-2.5 mb-6">
              <Sparkles className="w-5 h-5" style={{ color: 'var(--persimmon)' }} />
              <h2
                className="text-[17px] font-semibold"
                style={{
                  fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
                  color: 'var(--ink-black)',
                }}
              >
                AI 模型配置
              </h2>
            </div>

            <LLMConfigManager />
          </section>
        </div>
      </main>
    </div>
  );
}
