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
    description: "先看懂系统，再开始改代码。openai/codex 架构与开发定位指南。",
    type: "website",
    locale: "zh_CN",
    images: [
      {
        url: "og.png",
        width: 1734,
        height: 907,
        alt: "Codex Architecture Atlas — 先看懂系统，再开始改代码。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codex Architecture Atlas",
    description: "先看懂系统，再开始改代码。openai/codex 架构与开发定位指南。",
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
