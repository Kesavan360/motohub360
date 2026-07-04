import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotoHub360",
  description: "India's premium motorcycle showcase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}