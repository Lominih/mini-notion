"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

function extractWorkspaceId(pathname: string): string | undefined {
  const match = pathname.match(/\/workspace\/([^/]+)/);
  return match?.[1];
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const workspaceId = extractWorkspaceId(pathname);

  return (
    <div className="flex h-full">
      <Sidebar
        workspaceId={workspaceId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile header bar */}
        <div className="sticky top-0 z-20 flex items-center h-11 px-4 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md
              text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            aria-label="Open sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-2 text-sm font-medium text-text-primary">Mini Notion</span>
        </div>
        <div className="h-full">{children}</div>
      </main>
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}
