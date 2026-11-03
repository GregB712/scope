import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "@/styles/globals.css";

/**
 * Reading serif for platforms without a system serif. Apple platforms use
 * New York through `ui-serif` first (see --font-serif in globals.css).
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Scope", template: "%s | Scope" },
  description: "Your daily intelligence briefings, in one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sourceSerif.variable}>
      <body className="min-h-dvh">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
