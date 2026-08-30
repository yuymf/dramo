"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CatLogo } from "@/components/landing/CatLogo";
import { ArrowUp, Loader2 } from "lucide-react";
import { createProject } from "@/lib/api/projects";
import { useToast } from "@/components/ui/Toast";

const starters = [
  { label: "短片", text: "写一部十分钟短片，关于" },
  { label: "电影", text: "写一部电影剧本，关于" },
];

export function CreativeInput() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const project = await createProject(input.trim());
      sessionStorage.setItem(`project_${project.id}_initialMessage`, input.trim());
      router.push(`/projects/${project.id}/scripts`);
      showToast("项目已创建", "success");
    } catch (err) {
      console.error("Failed to create project:", err);
      showToast(err instanceof Error ? err.message : "创建项目失败", "error");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const applyStarter = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="mb-10">
        <h1
          className="text-4xl lg:text-5xl leading-tight"
          style={{
            fontFamily: "var(--font-noto-sans-sc), sans-serif",
            color: "var(--ink-black)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          今天想写
          <br />
          什么故事？
        </h1>
      </div>

      <div className="relative">
        <div className="absolute -right-28 top-4 hidden xl:block">
          <CatLogo size={88} />
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <div className="ink-textarea-wrap">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="一只住在月球上的猫，每天对着地球思考人类的故事……"
              className="ink-textarea"
              rows={4}
            />

            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              {input.trim() && (
                <span
                  className="text-xs"
                  style={{ color: "var(--ink-light)" }}
                >
                  Enter
                </span>
              )}
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="创建项目"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-150 disabled:opacity-20 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  background: input.trim() && !loading
                    ? "var(--ink-black)"
                    : "var(--rice-dark)",
                  color: input.trim() && !loading
                    ? "var(--rice-paper)"
                    : "var(--ink-light)",
                }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowUp className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 mt-6">
          {starters.map((starter) => (
            <button
              key={starter.label}
              type="button"
              onClick={() => applyStarter(starter.text)}
              className="px-3 py-1.5 text-sm rounded-full border transition-colors"
              style={{
                borderColor: "rgba(26, 26, 24, 0.1)",
                color: "var(--ink-wash)",
                background: "transparent",
              }}
            >
              {starter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
