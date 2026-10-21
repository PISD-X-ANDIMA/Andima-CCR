import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/appshell";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Andima CCR",
  description: "Credit Control & Receivables Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans"><AppShell>{children}</AppShell></body>
    </html>
  );
}
