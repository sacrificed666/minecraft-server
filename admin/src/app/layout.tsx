import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// Self-hosted at build time, so the page needs no CSP exception for Google.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Server Admin Panel",
  description: "Admin panel for the NeoForge Minecraft server",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
      <head>
        {/*
          Applies the stored theme before first paint. Without this the page
          renders in the OS theme and then flips, which is visible and ugly.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {/* Ambient layer is decorative only — hidden from assistive tech */}
        <div className="ambient" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
        </div>
        {children}
      </body>
    </html>
  );
}
