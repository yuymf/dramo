/**
 * 主内容区默认插槽
 * 当访问 /projects/[id] 时显示，通常会重定向到 scripts
 */
export default function DefaultContentSlot() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-700 mb-2 jp-serif">
          欢迎回来
        </h2>
        <p className="text-slate-500 jp-serif">
          请从左侧选择功能模块开始工作
        </p>
      </div>
    </div>
  );
}

