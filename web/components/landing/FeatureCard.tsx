"use client";

import { FileText, Film, Users } from "lucide-react";

interface FeatureCardProps {
  type: "script" | "storyboard" | "character";
  title: string;
  description: string;
  sceneNumber: string;
  sceneLocation: string;
  className?: string;
}

export function FeatureCard({
  type,
  title,
  description,
  sceneNumber,
  sceneLocation,
  className = "",
}: FeatureCardProps) {
  const getIcon = () => {
    switch (type) {
      case "script":
        return <FileText className="w-5 h-5" strokeWidth={1.5} />;
      case "storyboard":
        return <Film className="w-5 h-5" strokeWidth={1.5} />;
      case "character":
        return <Users className="w-5 h-5" strokeWidth={1.5} />;
    }
  };

  return (
    <div className={`cinema-card p-8 group ${className}`}>
      {/* Scene heading - like a real screenplay */}
      <div className="flex items-center gap-3 mb-6">
        <span className="cinema-page-num">{sceneNumber}</span>
        <div className="h-px flex-1" style={{ background: "rgba(212, 168, 83, 0.15)" }} />
      </div>

      <p className="scene-heading text-xs mb-6">
        {sceneLocation}
      </p>

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-sm flex items-center justify-center mb-5 transition-colors"
        style={{
          background: "rgba(212, 168, 83, 0.1)",
          color: "var(--cinema-amber)",
          border: "1px solid rgba(212, 168, 83, 0.2)",
        }}
      >
        {getIcon()}
      </div>

      {/* Title */}
      <h3
        className="text-xl font-semibold mb-3 tracking-wide"
        style={{ color: "var(--cinema-warm-white)" }}
      >
        {title}
      </h3>

      {/* Description as screenplay action line */}
      <p className="cinema-action-line">
        {description}
      </p>

      {/* Bottom accent line */}
      <div
        className="mt-8 h-px transition-all duration-500 group-hover:w-full w-12"
        style={{ background: "rgba(212, 168, 83, 0.3)" }}
      />
    </div>
  );
}
