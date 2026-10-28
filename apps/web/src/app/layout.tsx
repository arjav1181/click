import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@click/ui";
import "@click/ui/styles.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Click",
  description: "Open-source, self-hosted AI meeting assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body
        style={
          {
            "--font-sans": "var(--font-inter), ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
            "--font-reading": "var(--font-serif), Georgia, Cambria, \"Times New Roman\", serif",
            "--font-mono": "var(--font-mono-loaded), ui-monospace, SFMono-Regular, Menlo, monospace",
          } as React.CSSProperties
        }
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
