/**
 * 主内容区默认插槽 - 优化的项目欢迎页
 * 当访问 /projects/[id] 时显示，通常会重定向到 scripts
 * 设计语言：优雅的"墨纸工坊"美学，日式极简主义与创意工作空间的融合
 */
export default function DefaultContentSlot() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* 背景：分层纸质纹理 + 细微渐变光晕 */}
      <div className="absolute inset-0 rice-paper-bg">
        {/* 顶部月光般的温暖光晕 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-orange-100/[0.08] via-transparent to-transparent rounded-full blur-3xl pointer-events-none"></div>

        {/* 左下角柔和的笔墨晕染效果 */}
        <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-gradient-radial from-amber-200/[0.04] to-transparent rounded-full blur-3xl pointer-events-none opacity-60"></div>
      </div>

      {/* 主内容 - 墨纸工坊风格的卡片组 */}
      <div className="relative z-10 flex items-center justify-center w-full min-h-screen px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* 顶部装饰线 - 毛笔笔触风格 */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-stone-300/40 to-transparent"></div>
            <div className="w-1 h-1 rounded-full bg-orange-700/30"></div>
            <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-stone-300/40 to-transparent"></div>
          </div>

          {/* 欢迎标题 - 大气的宋体衬线字体 */}
          <h1 className="text-center mb-6">
            <span className="block text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="inline-block animate-fade-in" style={{ animationDelay: "0.1s" }}>
                欢
              </span>
              <span className="inline-block animate-fade-in" style={{ animationDelay: "0.15s" }}>
                迎
              </span>
              <span className="inline-block animate-fade-in" style={{ animationDelay: "0.2s" }}>
                回
              </span>
              <span className="inline-block animate-fade-in" style={{ animationDelay: "0.25s" }}>
                来
              </span>
            </span>
            <style>{`
              @keyframes fade-in-char {
                from {
                  opacity: 0;
                  transform: translateY(12px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .animate-fade-in {
                animation: fade-in-char 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
              }
            `}</style>
          </h1>

          {/* 描述性文案 - 温暖的引导语 */}
          <p className="text-center text-lg md:text-xl text-stone-500 mb-10 leading-relaxed max-w-xl mx-auto animate-fade-in" style={{ animationDelay: "0.35s" }}>
            在这里释放创意灵感，打造精彩直播台本。
            <br />
            <span className="text-sm text-stone-400 font-light">选择左侧功能模块，或继续探索</span>
          </p>

          {/* 功能导引卡片组 - 墨纸工坊的四大功能模块 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12 animate-fade-in" style={{ animationDelay: "0.45s" }}>
            {/* 输入模块 */}
            <div className="group relative ink-card-interactive p-6 cursor-pointer">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition-all duration-300">
                  <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 mb-1">输入信息</h3>
                  <p className="text-xs text-stone-500 line-clamp-2">描述您的直播主题和创意方向</p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-orange-50/50 via-transparent to-transparent"></div>
            </div>

            {/* 台本模块 */}
            <div className="group relative ink-card-interactive p-6 cursor-pointer">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition-all duration-300">
                  <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 mb-1">编辑台本</h3>
                  <p className="text-xs text-stone-500 line-clamp-2">精雕细琢每一句台词和场景</p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-amber-50/50 via-transparent to-transparent"></div>
            </div>

            {/* 角色模块 */}
            <div className="group relative ink-card-interactive p-6 cursor-pointer">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-rose-100 to-pink-50 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition-all duration-300">
                  <svg className="w-6 h-6 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 mb-1">管理角色</h3>
                  <p className="text-xs text-stone-500 line-clamp-2">定义人物特征与表演风格</p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-rose-50/50 via-transparent to-transparent"></div>
            </div>

            {/* 分镜模块 */}
            <div className="group relative ink-card-interactive p-6 cursor-pointer">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-100 to-blue-50 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition-all duration-300">
                  <svg className="w-6 h-6 text-sky-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2a1 1 0 00-1 1zm4 0v16a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2a1 1 0 00-1 1zm4 0v16a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2a1 1 0 00-1 1z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 mb-1">制作分镜</h3>
                  <p className="text-xs text-stone-500 line-clamp-2">规划镜头语言与视觉节奏</p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-sky-50/50 via-transparent to-transparent"></div>
            </div>
          </div>

          {/* 底部辅助文案 */}
          <div className="text-center text-sm text-stone-400 animate-fade-in" style={{ animationDelay: "0.55s" }}>
            <p className="mb-2">💡 提示：点击左侧导航栏快速切换模块</p>
            <p className="text-xs">创意无界，每一个想法都值得被看见</p>
          </div>

          {/* 底部装饰线 */}
          <div className="flex items-center justify-center gap-3 mt-12">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-stone-200/30 to-transparent"></div>
            <div className="w-0.5 h-0.5 rounded-full bg-stone-300/40"></div>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-stone-200/30 to-transparent"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

