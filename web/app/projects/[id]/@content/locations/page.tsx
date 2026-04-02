/**
 * Location Management Page - Multi-image generation and asset management
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { LocationImageGenerator } from "@/components/locations/LocationImageGenerator";
import { LocationAssetsList } from "@/components/locations/LocationAssetsList";
import { useAIChat } from "@/app/ai-chat-provider";
import { extractLocationsJson } from "@/lib/utils/json-context-extractor";
import { getProjectAssets } from "@/lib/utils/exporter";
import type { LocationImageAssetV2 } from "@/lib/models";
import { useToast } from "@/components/ui/Toast";
import { MapPin } from "lucide-react";

export default function LocationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [locations, setLocations] = useState<LocationImageAssetV2[]>([]);
  const { updateJsonData } = useAIChat();
  const { showToast } = useToast();

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // 加载地点数据
  useEffect(() => {
    async function loadLocations() {
      if (!projectId) return;
      try {
        const assetsResult = await getProjectAssets(projectId, { type: 'location' });
        setLocations(assetsResult.locations.map(l => ({
          id: l.id,
          locationName: l.name,
          description: l.description,
          alias: l.alias,
          images: l.images,
          createdAt: new Date().toISOString(),
        })));
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    }
    loadLocations();
  }, [projectId, refreshTrigger]);

  // Listen for pipeline completion to refresh location data
  useEffect(() => {
    const handlePipelineComplete = (e: Event) => {
      const { step } = (e as CustomEvent).detail;
      if (step === 'locations') {
        setRefreshTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener('pipeline-step-complete', handlePipelineComplete);
    return () => window.removeEventListener('pipeline-step-complete', handlePipelineComplete);
  }, []);

  // 注册到AI聊天上下文：当locations变化时更新JSON数据
  useEffect(() => {
    if (locations && locations.length > 0) {
      const jsonData = extractLocationsJson(locations);
      updateJsonData(jsonData);
    } else {
      updateJsonData(null);
    }
  }, [locations, updateJsonData]);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)]">
      <div className="px-6 py-4 border-b border-[var(--at-border)] bg-[var(--at-bg)]">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-[var(--at-text)] tracking-tight">地点管理</h1>
          <MapPin size={18} className="text-[var(--at-accent)]" />
        </div>
        <p className="text-sm text-[var(--at-text-tertiary)] mt-1">
          生成地点图片，管理场景资产库
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="h-full p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Assets Library */}
          <section className="bg-[var(--at-surface)] border border-[var(--at-border)] rounded-xl p-6">
            <div className="flex items-baseline gap-2 pb-3 border-b border-[var(--at-border-light)] mb-3">
              <h2 className="text-sm font-semibold text-[var(--at-text)]">资产库</h2>
              <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{locations.length}</span>
            </div>
            <p className="text-sm text-[var(--at-text-tertiary)] mb-4">
              已生成和上传的地点图片
            </p>
            <LocationAssetsList
              projectId={projectId}
              refreshTrigger={refreshTrigger}
            />
          </section>

          {/* Right: Generator Sidebar */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="bg-[var(--at-surface)] border border-[var(--at-border)] rounded-xl p-4">
              <LocationImageGenerator
                projectId={projectId}
                onGenerated={handleRefresh}
                onUploaded={handleRefresh}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
