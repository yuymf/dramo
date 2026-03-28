"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

export function ProjectsPageHeader() {
  const { status } = useSession();

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
            {status === "authenticated" && (
              <Button 
                onClick={() => signOut({ callbackUrl: "/" })}
                variant="outline" 
                size="sm" 
                className="gap-2 text-slate-700"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">登出</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

