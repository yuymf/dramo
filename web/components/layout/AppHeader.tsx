"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Lightbulb, History, Globe } from "lucide-react";
import { useTranslation, type Locale } from "@/lib/i18n";

interface AppHeaderProps {
  projectName?: string;
  mode?: string;
  onModeChange?: (mode: string) => void;
  onToggleInspirationPanel?: () => void;
  onToggleHistoryPanel?: () => void;
}

export function AppHeader({
  projectName: _projectName = "default project name",
  mode: propMode,
  onModeChange,
  onToggleInspirationPanel,
  onToggleHistoryPanel,
}: AppHeaderProps) {
  void _projectName;
  const [locale, setLocale] = useState<Locale>("zh");
  const { t } = useTranslation(locale);
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const getCurrentMode = (): string => {
    if (propMode) return propMode;
    if (pathname?.includes('/dialogue')) return 'dialogue';
    if (pathname?.includes('/hollywood')) return 'hollywood';
    return 'script';
  };

  const currentMode = getCurrentMode();
  const projectId = params?.id as string | undefined;

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  const handleModeChange = (newMode: string) => {
    if (onModeChange) {
      onModeChange(newMode);
      return;
    }

    if (projectId) {
      if (newMode === 'script') {
        router.push(`/projects/${projectId}/scripts`);
      } else if (newMode === 'dialogue') {
        router.push(`/projects/${projectId}/scripts/dialogue`);
      } else if (newMode === 'hollywood') {
        router.push(`/projects/${projectId}/scripts/hollywood`);
      }
    }
  };

  const modes = [
    { id: 'script', label: t("scriptMode") },
    { id: 'dialogue', label: t("dialogueMode") },
    { id: 'hollywood', label: t("hollywoodMode") },
  ];

  return (
    <header className="border-b border-[var(--at-border)] bg-[var(--at-surface)]">
      <div className="h-12 px-4 flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px]">
          <Link href="/projects" className="text-[var(--at-text-tertiary)] hover:text-[var(--at-text)] transition-colors">
            {t("projects")}
          </Link>
          <span className="text-[var(--at-text-tertiary)]">/</span>
          <span className="font-medium text-[var(--at-text)]">{t("script")}</span>
        </div>

        {/* Mode tabs — pill-style segmented control */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--at-surface-sunken)]">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${
                currentMode === m.id
                  ? "bg-[var(--at-surface)] text-[var(--at-text)] font-medium shadow-sm"
                  : "text-[var(--at-text-secondary)] hover:text-[var(--at-text)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 gap-1.5"
            onClick={onToggleInspirationPanel}
          >
            <Lightbulb size={14} />
            {t("inspiration")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 gap-1.5"
            onClick={onToggleHistoryPanel}
          >
            <History size={14} />
            {t("history")}
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLocale}
            className="text-xs h-7 px-2"
          >
            <Globe size={14} />
            {locale === "zh" ? "EN" : "中"}
          </Button>
        </div>
      </div>
    </header>
  );
}
