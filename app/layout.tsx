import type { Metadata } from "next";
import localFont from "next/font/local";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import "./globals.css";

/* Variable fonts vendored in app/fonts (Google Fonts latin subsets, OFL) so
 * builds never fetch fonts.googleapis.com — build-time DNS to it proved flaky. */
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  weight: "300 700",
  variable: "--font-space-grotesk",
  display: "swap",
});
const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "100 800",
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
