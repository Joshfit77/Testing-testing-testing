"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { shouldGoBackTo } from "@/lib/nav-memory";
import { cn } from "@/lib/utils";

/**
 * "← Parent" link for detail screens. When you came from that parent screen it goes back in history
 * (so the list keeps its filters and scroll position); otherwise — opened from elsewhere, a shared
 * link or a reload — it opens the parent. The label always matches where you land.
 */
export function BackLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (shouldGoBackTo(href)) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn("inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground", className)}
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}
