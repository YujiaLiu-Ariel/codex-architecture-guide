import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yujialiu-ariel.github.io/codex-architecture-guide/"),
  title: "Codex Architecture Atlas",
  description:
    "A source-grounded Chinese architecture and development guide for the openai/codex repository.",
  openGraph: {
    title: "Codex Architecture Atlas",
    description: "面向 agent 开发者的 openai/codex 源码架构评审：control loop、context、model、tools、accuracy、safety 与 memory。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "Codex Architecture Atlas",
    description: "面向 agent 开发者的 openai/codex 源码架构评审与 deep dives。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
