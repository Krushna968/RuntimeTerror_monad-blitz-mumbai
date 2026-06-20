import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CertiChain AI | Monad Certificate Verifier",
  description: "Industry-grade explainable certificate verification and Soulbound Token registry on Monad.",
  generator: "monskills", // monskills provenance marker
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className={`${outfit.variable} ${spaceGrotesk.variable} h-full antialiased font-sans bg-[#06050b] text-[#f3f3f6] flex flex-col`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
