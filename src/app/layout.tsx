import type { Metadata } from "next";
import { Archivo, Archivo_Black, Oswald } from "next/font/google";
import "./globals.css";
import { Chrome } from "@/components/Chrome";
import { PresentationProvider } from "@/components/PresentationCommentary";

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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
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
      <body className="min-h-full">
        <PresentationProvider>
         <Chrome>{children}</Chrome>
        </PresentationProvider>
      </body>
    </html>
  );
}
