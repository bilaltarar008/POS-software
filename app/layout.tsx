import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from './components/Nav'
import ServiceWorkerRegister from './components/ServiceWorkerRegister'
import SyncManager from './components/SyncManager'
import AuthGuard from './components/AuthGuard'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: '#0070f3',
}

export const metadata: Metadata = {
  title: 'POS Software',
  description: 'Pulses and wheat trading POS system',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
                <AuthGuard>

        {children}
          </AuthGuard>

        <SyncManager />
        <ServiceWorkerRegister />
        </body>
    </html>
  );
}
