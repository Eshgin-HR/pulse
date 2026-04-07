import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PULSE — Weekly Intelligence System",
  description: "Your weekly signal. What's alive, what's blocked, what's growing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
