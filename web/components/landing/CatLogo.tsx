"use client";

import Image from "next/image";

interface CatLogoProps {
  size?: number;
  className?: string;
}

export function CatLogo({ size = 300, className = "" }: CatLogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div className="animate-breathe">
        <Image
          src="/logo.jpg"
          alt="DRAMO 猫咪Logo"
          fill
          className="object-contain"
          sizes={`${size}px`}
          priority
        />
      </div>
    </div>
  );
}

