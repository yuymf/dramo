/**
 * Right sidebar inspiration panel
 */
"use client";
import { useEffect, useState } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";

interface Inspiration {
  id: string;
  text: string;
  category: "quotes" | "topics" | "interactions" | "hotspots";
  relevance?: number;
  source?: string;
}

interface InspirationPanelProps {
  projectId: string;
  sceneId?: string;
  onInsert: (text: string) => void;
  onFavorite: (inspirationId: string) => void;
  onCollapse?: () => void;
}

const CATEGORY_LABELS = {
  quotes: "💬 Quotes",
  topics: "📋 Topics",
  interactions: "🤝 Interactions",
  hotspots: "🔥 Hotspots",
};

export function InspirationPanel({
  projectId,
  sceneId, // eslint-disable-line @typescript-eslint/no-unused-vars -- 保留参数以保持接口兼容性
  onInsert,
  onFavorite,
  onCollapse,
}: InspirationPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // 轻量加载：进入项目时自动获取已存储/缓存的灵感
    async function fetchInspirations() {
      if (!projectId || initialized) return;
      setLoading(true);
      try {
        // 使用新的轻量接口 GET /api/inspirations/{projectId}
        const res = await api<{ data: Inspiration[] }>(
          `/api/inspirations/${projectId}`,
          { cacheTtlMs: 300000 } // 缓存5分钟
        );
        setInspirations(res.data);
        setInitialized(true);
      } catch (err) {
        console.error("Failed to fetch inspirations:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInspirations();
  }, [projectId, initialized]);

  // 重上下文刷新：基于当前台本内容生成精准推荐
  const handleRefresh = async () => {
    if (!projectId) {
      showToast("缺少项目信息", "error");
      return;
    }
    
    setRefreshing(true);
    try {
      // 使用新的重上下文接口 POST /api/inspirations/{projectId}/recommend
      // TODO: 传入完整的 script 对象和当前编辑位置以获得更精准的推荐
      const res = await api<{ data: Inspiration[] }>(
        `/api/inspirations/${projectId}/recommend`,
        {
          method: "POST",
          body: {
            // script: currentScript, // 需要从父组件传入
            // position: { actOrder, sceneOrder, blockOrder },
            category: activeCategory || undefined,
          },
        }
      );
      setInspirations(res.data);
      showToast("灵感已更新！", "success");
    } catch (err) {
      console.error("Failed to refresh inspirations:", err);
      showToast("更新灵感失败", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // 客户端过滤灵感，避免重新请求
  const filteredInspirations = activeCategory 
    ? inspirations.filter(insp => insp.category === activeCategory)
    : inspirations;

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-10 glass-morphism">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="ink-section-title">灵感</h2>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="更新灵感"
              title="依据当前剧本生成最贴近的灵感"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {onCollapse && (
              <Button
                onClick={onCollapse}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="收起灵感面板"
                title="收起"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        {/* Category Tabs */}
        <div className="px-3 pt-2 pb-3">
          <Tabs
            value={activeCategory ?? "all"}
            onValueChange={(val) => setActiveCategory(val === "all" ? null : val)}
          >
            <TabsList className="w-full grid grid-cols-3 gap-1">
              <TabsTrigger value="all" className="text-xs jp-serif">
                全部
              </TabsTrigger>
              <TabsTrigger value="quotes" className="text-xs jp-serif">
                💬
              </TabsTrigger>
              <TabsTrigger value="topics" className="text-xs jp-serif">
                📋
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Inspiration Cards */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 px-3 pb-3">
          {loading && (
            <p className="text-sm text-slate-400 italic jp-serif">加载中...</p>
          )}
          {!loading && filteredInspirations.length === 0 && (
            <p className="text-sm text-slate-400 italic jp-serif">暂无灵感</p>
          )}
          {!loading &&
            filteredInspirations.map((insp) => (
              <Card
                key={insp.id}
                className="hover:border-[var(--brand-500)] transition-colors bg-white shadow-sm"
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--muted-bg)] text-slate-600 jp-serif">
                      {CATEGORY_LABELS[insp.category]}
                    </span>
                    {insp.relevance && (
                      <span className="text-xs text-slate-500 font-mono">
                        {Math.round(insp.relevance * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-7 mb-3 text-slate-800/90 jp-serif tracking-wide">
                    {insp.text}
                  </p>
                  {insp.source && (
                    <p className="text-xs text-slate-400 mb-3 jp-serif">📚 {insp.source}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onInsert(insp.text)}
                      size="sm"
                      className="text-xs h-7 jp-serif"
                    >
                      插入
                    </Button>
                    <Button
                      onClick={() => onFavorite(insp.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 jp-serif"
                    >
                      ⭐ 收藏
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}

