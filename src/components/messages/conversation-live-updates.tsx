"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function ConversationLiveUpdates({ messageCount }: { messageCount: number }) {
  const router = useRouter();
  const latestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latestRef.current?.scrollIntoView({ block: "nearest" });
  }, [messageCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 8000);

    return () => window.clearInterval(interval);
  }, [router]);

  return <div ref={latestRef} aria-hidden="true" />;
}
