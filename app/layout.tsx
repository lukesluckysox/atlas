import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";
import { themeInitScript } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "Trace — A portrait of who you are",
  description: "Trace builds a portrait of who you are. Not through introspection. Through what you love, where you've been, and what sounds right.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trace",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4A843",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Prevent FOUC: set html.dark before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "#2C1810",
                color: "#F5F0E8",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "13px",
                borderRadius: "0",
                padding: "12px 20px",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
