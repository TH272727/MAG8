import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mag8",
  description:
    "Four independent research lenses hunting the next trillion-dollar companies. Confluence is the signal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
