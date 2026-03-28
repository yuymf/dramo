"use client";

import { SiteHeader } from "@/components/landing/SiteHeader";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

export default function BlogPage() {
  const posts = [
    {
      id: 1,
      title: "如何用AI创作你的第一个剧本",
      excerpt: "从零开始，学习如何使用DRAMO的AI功能快速生成专业格式的剧本，让创意快速落地。",
      date: "2025年1月15日",
      category: "教程",
    },
    {
      id: 2,
      title: "分镜设计的艺术：从文字到画面",
      excerpt: "探索如何将文字剧本转化为视觉分镜，掌握分镜设计的基本原理和实用技巧。",
      date: "2025年1月10日",
      category: "设计",
    },
    {
      id: 3,
      title: "角色塑造的五个关键要素",
      excerpt: "深入了解如何创建立体的角色，从性格设定到关系图谱，让人物更加生动。",
      date: "2025年1月5日",
      category: "创作",
    },
    {
      id: 4,
      title: "AI辅助创作的未来趋势",
      excerpt: "探讨AI技术在影视创作领域的应用前景，以及如何与AI协作提升创作效率。",
      date: "2024年12月28日",
      category: "观点",
    },
    {
      id: 5,
      title: "团队协作的最佳实践",
      excerpt: "分享在DRAMO平台上进行团队协作的经验，让多人创作更加流畅高效。",
      date: "2024年12月20日",
      category: "协作",
    },
    {
      id: 6,
      title: "从灵感到成片：完整创作流程",
      excerpt: "详细介绍从最初的创意灵感到最终成片的完整创作流程，帮助创作者建立系统化的工作方法。",
      date: "2024年12月15日",
      category: "流程",
    },
  ];

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture">
      <SiteHeader />

      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h1 
              className="text-4xl lg:text-5xl font-semibold"
              style={{ color: "var(--muji-charcoal)" }}
            >
              博客
            </h1>
            <p 
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--muji-dark-gray)" }}
            >
              探索创作技巧、行业动态和最佳实践
            </p>
          </div>

          {/* Blog Posts List */}
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="paper-card rounded-lg p-8 transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span 
                        className="text-xs font-medium px-2 py-1 rounded"
                        style={{ 
                          background: "var(--muji-oatmeal)",
                          color: "var(--muji-dark-gray)"
                        }}
                      >
                        {post.category}
                      </span>
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muji-dark-gray)" }}>
                        <Calendar className="w-3 h-3" />
                        <span>{post.date}</span>
                      </div>
                    </div>
                    <h2 
                      className="text-2xl font-semibold mb-3"
                      style={{ color: "var(--muji-charcoal)" }}
                    >
                      {post.title}
                    </h2>
                    <p 
                      className="text-sm leading-relaxed mb-4"
                      style={{ color: "var(--muji-dark-gray)" }}
                    >
                      {post.excerpt}
                    </p>
                  </div>
                </div>
                <Link
                  href="#"
                  className="inline-flex items-center gap-2 text-sm font-medium group"
                  style={{ color: "var(--muji-charcoal)" }}
                >
                  阅读更多
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
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

