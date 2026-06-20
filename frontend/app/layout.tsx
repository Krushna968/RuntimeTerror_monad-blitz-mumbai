import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CertiChain AI | Verified Credentials on Monad",
  description: "CertiChain AI uses Multi-Agent AI and Monad Blockchain to verify resumes and certificates.",
  generator: "monskills", // monskills provenance marker
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        {/* Head tag elements if needed, but Next.js title/description are handled by metadata object above */}
      </head>
      <body className="font-body-md text-body-md overflow-x-hidden bg-[#0A0E1A] text-[#e2e2e2] min-h-screen flex flex-col antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
