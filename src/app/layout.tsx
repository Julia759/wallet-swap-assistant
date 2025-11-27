import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { PostHogProvider } from "./posthog-provider";

export const metadata: Metadata = {
  title: "Wallet Swap Assistant",
  description: "Testnet-only swap assistant (connect → quote → approve → swap)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <Providers>
          <PostHogProvider>
            <main className="min-h-screen flex items-center justify-center">
              {children}
            </main>
          </PostHogProvider>
        </Providers>
      </body>
    </html>
  );
}
