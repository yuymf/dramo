"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { ArrowRight, Sparkles, PenTool, Clapperboard } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/projects");
  };

  return (
    <div className="cinema-page cinema-grain">
      <SiteHeader />

      {/* ============ HERO ============ */}
      <section className="relative spotlight-bg pt-32 pb-24 px-4 sm:px-6 lg:px-8 min-h-[90vh] flex items-center">
        {/* Subtle vertical lines - screenplay margin */}
        <div
          className="absolute left-[8%] top-0 bottom-0 w-px hidden lg:block"
          style={{ background: "rgba(212, 168, 83, 0.06)" }}
        />
        <div
          className="absolute right-[8%] top-0 bottom-0 w-px hidden lg:block"
          style={{ background: "rgba(212, 168, 83, 0.06)" }}
        />

        <div className="max-w-6xl mx-auto w-full">
          {/* Page number - top right like a screenplay */}
          <div className="cinema-reveal cinema-reveal-delay-1 flex justify-end mb-16">
            <span className="cinema-page-num">P. 01</span>
          </div>

          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left: Text Content — takes more space */}
            <div className="lg:col-span-7 space-y-10">
              {/* Scene heading */}
              <div className="cinema-reveal cinema-reveal-delay-1">
                <p className="scene-heading text-xs mb-8">
                  INT. 创作者的工作室 — 深夜
                </p>
              </div>

              {/* Main headline */}
              <h1 className="cinema-reveal cinema-reveal-delay-2">
                <span
                  className="block text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight"
                  style={{ color: "var(--cinema-warm-white)" }}
                >
                  和你的猫猫，
                </span>
                <span
                  className="block text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mt-2"
                  style={{ color: "var(--cinema-amber)" }}
                >
                  写下第一个故事
                </span>
              </h1>

              {/* Screenplay-style action description */}
              <div className="cinema-reveal cinema-reveal-delay-3 max-w-lg">
                <p className="cinema-action-line text-base leading-relaxed">
                  桌上的台灯投下暖黄色的光。一只猫蜷在键盘旁，眯着眼注视屏幕。
                  创作者打开 DRAMO，灵感从指尖流淌——剧本、分镜、角色，
                  一切在AI伙伴的陪伴下成型。
                </p>
              </div>

              {/* CTA */}
              <div className="cinema-reveal cinema-reveal-delay-4 flex flex-col sm:flex-row items-start gap-4 pt-2">
                <button
                  onClick={handleGetStarted}
                  className="cinema-cta px-8 py-4 text-sm flex items-center gap-3 group"
                >
                  免费开始创作
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <span
                  className="cinema-page-num self-center pt-1"
                  style={{ color: "var(--cinema-dim)" }}
                >
                  无需信用卡 · 永久免费起步
                </span>
              </div>
            </div>

            {/* Right: Cat character with cinematic framing */}
            <div className="lg:col-span-5 cinema-reveal cinema-reveal-delay-5">
              <div className="relative flex items-center justify-center">
                {/* Film frame border */}
                <div
                  className="absolute -inset-4 rounded-sm"
                  style={{ border: "1px solid rgba(212, 168, 83, 0.12)" }}
                />
                <div
                  className="absolute -inset-8 rounded-sm hidden lg:block"
                  style={{ border: "1px solid rgba(212, 168, 83, 0.05)" }}
                />

                {/* The cat mascot - inverted for dark bg */}
                <div className="relative w-full aspect-square cat-glow p-12">
                  {/* Amber radial glow behind the cat */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 45%, rgba(212, 168, 83, 0.1) 0%, transparent 70%)",
                    }}
                  />
                  <Image
                    src="/icon.png"
                    alt="DRAMO 猫猫创作伙伴"
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-contain p-8"
                    style={{ filter: "invert(1) brightness(0.85) sepia(0.3) saturate(1.5) hue-rotate(10deg)" }}
                    priority
                  />
                </div>

                {/* Corner markers - like film viewfinder */}
                <div
                  className="absolute -top-2 -left-2 w-5 h-5 border-l-2 border-t-2"
                  style={{ borderColor: "var(--cinema-amber)" }}
                />
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 border-r-2 border-t-2"
                  style={{ borderColor: "var(--cinema-amber)" }}
                />
                <div
                  className="absolute -bottom-2 -left-2 w-5 h-5 border-l-2 border-b-2"
                  style={{ borderColor: "var(--cinema-amber)" }}
                />
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 border-r-2 border-b-2"
                  style={{ borderColor: "var(--cinema-amber)" }}
                />

                {/* Label under cat */}
                <div className="absolute -bottom-10 left-0 right-0 text-center">
                  <p
                    className="screenplay-font text-xs tracking-wider"
                    style={{ color: "var(--cinema-dim)" }}
                  >
                    YOUR AI WRITING COMPANION
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DIVIDER ============ */}
      <div className="cinema-divider mx-auto max-w-4xl" />

      {/* ============ CAPABILITIES TICKER ============ */}
      <section className="py-10 overflow-hidden" style={{ background: "var(--cinema-dark)" }}>
        <div className="cinema-ticker-wrap">
          {/* Repeat items enough to exceed any viewport width, then duplicate for seamless loop */}
          {[0, 1].map((setIndex) => (
            <div
              key={setIndex}
              className="cinema-ticker-track"
              aria-hidden={setIndex === 1}
            >
              {Array.from({ length: 3 }, () => [
                "剧本生成",
                "分镜设计",
                "角色档案",
                "关系图谱",
                "场景描写",
                "对白创作",
                "导出PDF",
                "AI对话",
              ]).flat().map((item, i) => (
                <span
                  key={i}
                  className="screenplay-font text-xs tracking-[0.2em] uppercase flex items-center gap-3 shrink-0"
                  style={{ color: "var(--cinema-dim)" }}
                >
                  <span
                    className="w-1 h-1 rounded-full inline-block shrink-0"
                    style={{ background: "var(--cinema-amber)" }}
                  />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8" style={{ background: "var(--cinema-black)" }}>
        {/* Section heading */}
        <div className="max-w-6xl mx-auto mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="cinema-page-num">P. 02</span>
            <div className="cinema-divider flex-1" />
          </div>
          <p className="scene-heading text-xs mb-4">
            INT. DRAMO 工作台 — 功能一览
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ color: "var(--cinema-warm-white)" }}
          >
            从灵感到成片，
            <span style={{ color: "var(--cinema-amber)" }}>每一步都有AI相伴</span>
          </h2>
        </div>

        {/* Feature cards */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="cinema-reveal cinema-reveal-delay-1">
            <FeatureCard
              type="script"
              title="剧本生成"
              description="AI智能生成专业格式的剧本，从创意到完整台本，让灵感快速落地成文字。支持多种剧本格式，实时预览排版效果。"
              sceneNumber="SCENE 01"
              sceneLocation="INT. 编剧室 — 白天"
              className="h-full"
            />
          </div>

          <div className="cinema-reveal cinema-reveal-delay-2">
            <FeatureCard
              type="storyboard"
              title="分镜创作"
              description="可视化分镜故事板设计，手绘风格草图生成，镜头语言辅助建议。从文字到视觉的无缝衔接。"
              sceneNumber="SCENE 02"
              sceneLocation="INT. 导演监视器前 — 夜晚"
              className="h-full"
            />
          </div>

          <div className="cinema-reveal cinema-reveal-delay-3">
            <FeatureCard
              type="character"
              title="角色设计"
              description="完整的角色档案、关系图谱、性格标签与台词风格分析，让人物塑造更立体，角色设定更清晰。"
              sceneNumber="SCENE 03"
              sceneLocation="INT. 角色档案室 — 黄昏"
              className="h-full"
            />
          </div>
        </div>
      </section>

      {/* ============ WORKFLOW SECTION ============ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 spotlight-bg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <span className="cinema-page-num">P. 03</span>
            <div className="cinema-divider flex-1" />
          </div>

          <p className="scene-heading text-xs mb-4">
            EXT. 创作流程 — 三步成片
          </p>

          <div className="grid md:grid-cols-3 gap-0 mt-16">
            {/* Step 1 */}
            <div className="relative p-8 border-b md:border-b-0 md:border-r" style={{ borderColor: "rgba(212, 168, 83, 0.12)" }}>
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="screenplay-font text-4xl font-bold"
                  style={{ color: "rgba(212, 168, 83, 0.2)" }}
                >
                  01
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <PenTool className="w-5 h-5" style={{ color: "var(--cinema-amber)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--cinema-warm-white)" }}>
                  输入灵感
                </h3>
              </div>
              <p className="cinema-action-line">
                用一句话、一段描述、或一个模糊的念头开始。AI会帮你梳理结构、补充细节。
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-8 border-b md:border-b-0 md:border-r" style={{ borderColor: "rgba(212, 168, 83, 0.12)" }}>
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="screenplay-font text-4xl font-bold"
                  style={{ color: "rgba(212, 168, 83, 0.2)" }}
                >
                  02
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5" style={{ color: "var(--cinema-amber)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--cinema-warm-white)" }}>
                  AI协同创作
                </h3>
              </div>
              <p className="cinema-action-line">
                剧本、角色、分镜同步生成。随时与AI对话调整方向，直到满意为止。
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="screenplay-font text-4xl font-bold"
                  style={{ color: "rgba(212, 168, 83, 0.2)" }}
                >
                  03
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Clapperboard className="w-5 h-5" style={{ color: "var(--cinema-amber)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--cinema-warm-white)" }}>
                  导出交付
                </h3>
              </div>
              <p className="cinema-action-line">
                一键导出专业格式的PDF剧本、分镜表或完整项目包，直接进入制作流程。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8" style={{ background: "var(--cinema-black)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="scene-heading text-xs mb-8 cinema-reveal">
            EXT. 终幕 — FADE IN
          </p>

          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 cinema-reveal cinema-reveal-delay-1"
            style={{ color: "var(--cinema-warm-white)" }}
          >
            每个好故事，<br />
            都值得被<span style={{ color: "var(--cinema-amber)" }}>写下来</span>。
          </h2>

          <p className="cinema-action-line text-base mb-10 max-w-md mx-auto cinema-reveal cinema-reveal-delay-2">
            你的下一个创意正在等待。打开 DRAMO，让它变成现实。
          </p>

          <div className="cinema-reveal cinema-reveal-delay-3">
            <button
              onClick={handleGetStarted}
              className="cinema-cta px-10 py-5 text-sm inline-flex items-center gap-3 group"
            >
              立即开始
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer
        className="relative py-12 px-4 sm:px-6 lg:px-8 border-t"
        style={{ background: "var(--cinema-dark)", borderColor: "rgba(212, 168, 83, 0.08)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="screenplay-font text-sm font-bold tracking-widest uppercase"
                style={{ color: "var(--cinema-amber)" }}
              >
                DRAMO
              </span>
              <span className="cinema-page-num">© 2025</span>
            </div>
            <p className="cinema-page-num">
              FADE OUT.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
