import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mag8 — the next trillion-dollar leaderboard",
    template: "%s · Mag8",
  },
  description:
    "Four independent research lenses hunt the next generation of mega-cap stocks. When independent methods agree, that agreement is the signal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
