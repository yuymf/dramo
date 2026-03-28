"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CatLogo } from "@/components/landing/CatLogo";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { createProject } from "@/lib/api/projects";
import { useToast } from "@/components/ui/Toast";

interface CreativeInputProps {
  userName?: string | null;
  onQuickAction?: (action: string) => void;
}

export function CreativeInput({ userName }: CreativeInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
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
      const initialMessage = input.trim();
      sessionStorage.setItem(`project_${project.id}_initialMessage`, initialMessage);
      router.push(`/projects/${project.id}?openChat=true`);
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

  const greeting = userName
    ? `${userName}，`
    : "";

  return (
    <div className="relative max-w-2xl mx-auto">
      {/* Greeting section */}
      <div className="mb-12 ink-reveal">
        <p
          className="text-sm tracking-widest uppercase mb-4 ink-ui"
          style={{ color: "var(--ink-light)", letterSpacing: "0.2em" }}
        >
          {greeting}begin your story
        </p>
        <h1
          className="text-4xl lg:text-5xl ink-display leading-tight"
          style={{ color: "var(--ink-black)" }}
        >
          今天想写
          <br />
          <span className="relative inline-block">
            什么故事
            <span
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--persimmon), var(--persimmon-soft))",
                opacity: 0.7,
              }}
            />
          </span>
          ？
        </h1>
      </div>

      {/* Creative input area */}
      <div className="relative ink-reveal ink-reveal-2">
        {/* Cat companion — floating beside */}
        <div className="absolute -right-28 top-4 hidden xl:block ink-float">
          <div className="relative">
            <CatLogo size={88} />
            {isFocused && (
              <div
                className="absolute -top-2 -left-2 w-3 h-3 rounded-full"
                style={{ background: "var(--persimmon)" }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "var(--persimmon)",
                    animation: "ink-pulse-ring 1.5s ease-out infinite",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Textarea */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="ink-textarea-wrap">
            {/* Decorative corner mark */}
            <div
              className="absolute top-3 left-4 flex items-center gap-1.5"
              style={{ color: "var(--ink-light)", opacity: 0.3 }}
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-[10px] tracking-wider uppercase ink-ui">Draft</span>
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="一只住在月球上的猫，每天对着地球思考人类的故事……"
              className="ink-textarea mt-4"
              rows={4}
            />

            {/* Submit button */}
            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              {input.trim() && (
                <span
                  className="text-xs ink-ui"
                  style={{ color: "var(--ink-light)", opacity: 0.5 }}
                >
                  Enter ↵
                </span>
              )}
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}
