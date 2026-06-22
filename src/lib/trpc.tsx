"use client";

import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { type AppRouter } from "@/server/routers/_app";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          headers() {
            const headers = new Headers();
            if (typeof window !== "undefined") {
              const token = localStorage.getItem("access_token");
              if (token) headers.set("authorization", `Bearer ${token}`);

              // Send workspace ID for workspace-scoped procedures
              const pathParts = window.location.pathname.split("/");
              const wsIdx = pathParts.indexOf("workspace");
              if (wsIdx >= 0 && pathParts[wsIdx + 1]) {
                headers.set("x-workspace-id", pathParts[wsIdx + 1]);
              }
            }
            return headers;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
