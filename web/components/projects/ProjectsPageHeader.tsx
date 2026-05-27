"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export function ProjectsPageHeader() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="relative w-10 h-10">
                <Image
                  src="/icon.png"
                  alt="Dramo.ai Logo"
                  fill
                  sizes="40px"
                  className="object-contain rounded-lg"
                />
              </div>
              <span className="text-xl font-bold text-slate-900 hidden sm:inline">
                Dramo.ai
              </span>
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home size={16} />
                <span className="hidden sm:inline">首页</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
