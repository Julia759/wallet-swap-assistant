"use client";

import { ReactNode, useEffect } from "react";
import posthog from "posthog-js";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
      person_profiles: "identified_only",
    });
  }, []);

  return <>{children}</>;
}

export { posthog };


