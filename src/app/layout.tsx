import type { Metadata } from "next";
import { Archivo, Archivo_Black, Oswald } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Check-In Champions",
  description: "Hotels compete for your booking. Open a trip pack, run the bracket, book the champion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="px-6 py-8 text-center text-xs text-chalk-dim">
          Check-In Champions · Hack the 6ix · powered by live Stay22 data — the champion is a real,
          bookable recommendation.
        </footer>
      </body>
    </html>
  );
}
