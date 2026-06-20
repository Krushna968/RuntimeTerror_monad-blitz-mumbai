"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Shield, Briefcase, Award } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#231f42] bg-[#06050b]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2 text-white group">
          <Shield className="h-7 w-7 text-brand-purple transition-transform group-hover:scale-110" />
          <span className="font-display text-xl font-bold tracking-tight bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">
            CertiChain AI
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#836efd] border border-[#836efd]/30 px-1.5 py-0.5 rounded">
            MONAD
          </span>
        </Link>

        {/* Navigation Items (Removed Portfolio as requested) */}
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <span className="flex items-center gap-1.5 text-brand-purple">
            <Shield className="h-4 w-4" />
            Verifier Dashboard
          </span>
        </nav>

        {/* Empty space for alignment (Removed Wallet Connect) */}
        <div className="flex items-center gap-4">
        </div>
      </div>
    </header>
  );
}
