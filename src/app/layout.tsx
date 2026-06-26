import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f3df",
};

export const metadata: Metadata = {
  title: "Polla Mundial",
  description: "Pronosticos deportivos - Mundial 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Polla Mundial",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="light"
          position="top-center"
          toastOptions={{
            style: {
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(15, 23, 42, 0.1)",
              color: "#1f2937",
              boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
            },
          }}
        />
      </body>
    </html>
  );
}
