"use client";

import { SiteHeader } from "@/components/landing/SiteHeader";
import { Film } from "lucide-react";

export default function CasesPage() {
  const cases = [
    {
      id: 1,
      title: "科幻短剧《时间碎片》",
      description: "一部关于时间旅行的科幻作品，展示了完整的剧本创作和分镜设计流程。",
      image: "/logo.jpg",
    },
    {
      id: 2,
      title: "都市情感剧《城市之光》",
      description: "现代都市背景的情感故事，展现了角色设计和场景构建的完整过程。",
      image: "/logo.jpg",
    },
    {
      id: 3,
      title: "悬疑推理《迷雾重重》",
      description: "紧张刺激的悬疑推理剧，展示了复杂角色关系和分镜设计的巧妙运用。",
      image: "/logo.jpg",
    },
    {
      id: 4,
      title: "青春校园《夏日记忆》",
      description: "温暖治愈的青春校园故事，展现了轻松活泼的创作风格。",
      image: "/logo.jpg",
    },
    {
      id: 5,
      title: "古装历史《王朝风云》",
      description: "宏大的历史背景，展示了复杂场景和人物关系的构建。",
      image: "/logo.jpg",
    },
    {
      id: 6,
      title: "奇幻冒险《魔法森林》",
      description: "充满想象力的奇幻世界，展现了丰富的视觉设计和角色塑造。",
      image: "/logo.jpg",
    },
  ];

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture">
      <SiteHeader />

      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h1 
              className="text-4xl lg:text-5xl font-semibold"
              style={{ color: "var(--muji-charcoal)" }}
            >
              精选作品
            </h1>
            <p 
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--muji-dark-gray)" }}
            >
              在DRAMO探索丰富的创意作品，看看其他创作者如何用AI实现他们的故事梦想
            </p>
          </div>

          {/* Cases Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="paper-card rounded-lg overflow-hidden transition-transform hover:scale-105"
              >
                <div className="relative h-48 muji-paper-texture" style={{ background: "var(--muji-light-gray)" }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-16 h-16 opacity-20" style={{ color: "var(--muji-dark-gray)" }} />
                  </div>
                </div>
                <div className="p-6">
                  <h3 
                    className="text-xl font-semibold mb-2"
                    style={{ color: "var(--muji-charcoal)" }}
                  >
                    {caseItem.title}
                  </h3>
                  <p 
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--muji-dark-gray)" }}
                  >
                    {caseItem.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t" style={{ borderColor: "rgba(0, 0, 0, 0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center" style={{ color: "var(--muji-dark-gray)" }}>
            <p className="text-sm">© 2025 DRAMO. 保留所有权利。</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

