"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";

export function SiteHeader() {
  const router = useRouter();
  const { status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => {
    const redirectUrl = "/projects";
    if (status === "authenticated") {
      router.push(redirectUrl);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  };

  const navItems = [
    { label: "首页", href: "/" },
    { label: "案例", href: "/cases" },
    { label: "价格", href: "/pricing" },
    { label: "博客", href: "/blog" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 cinema-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-amber-800/30 group-hover:ring-amber-600/50 transition-all">
              <Image
                src="/icon.png"
                alt="DRAMO Logo"
                fill
                sizes="32px"
                className="object-cover"
                style={{ filter: "invert(1) brightness(0.9) sepia(0.2)" }}
              />
            </div>
            <span
              className="screenplay-font text-sm font-bold tracking-widest uppercase"
              style={{ color: "var(--cinema-amber)" }}
            >
              DRAMO
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-10">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="screenplay-font text-xs tracking-widest uppercase transition-colors hover:text-amber-400"
                style={{ color: "var(--cinema-warm-gray)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={handleGetStarted}
              className="cinema-cta px-6 py-2.5 text-xs"
            >
              开始创作
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            style={{ color: "var(--cinema-warm-gray)" }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: "var(--cinema-dark)",
            borderColor: "rgba(212, 168, 83, 0.1)",
          }}
        >
          <div className="px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 screenplay-font text-xs tracking-widest uppercase transition-colors hover:text-amber-400"
                style={{ color: "var(--cinema-warm-gray)" }}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGetStarted();
                }}
                className="cinema-cta w-full px-6 py-3 text-xs"
              >
                开始创作
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
